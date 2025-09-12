import { generateUUID } from '@/lib/utils';
import { tool, type UIMessageStreamWriter } from 'ai';
import { z } from 'zod';
import type { Session } from 'next-auth';
import {
  artifactKinds,
  documentHandlersByArtifactKind,
} from '@/lib/artifacts/server';
import type { ChatMessage } from '@/lib/types';
import {
  validateSummaryStructure,
  embedMetadataInContent,
} from '@/lib/ai/utils/summary-parser';

interface CreateDocumentProps {
  session: Session;
  dataStream: UIMessageStreamWriter<ChatMessage>;
}

const createDocumentSchema = z.object({
  title: z.string(),
  kind: z.enum(artifactKinds),
  documentType: z
    .enum(['general', 'meeting-summary', 'report', 'action-items'])
    .optional()
    .default('general'),
  metadata: z
    .object({
      isTranscriptSummary: z.boolean().optional(),
      transcriptUrl: z.string().optional(),
      meetingDate: z.string().optional(),
      participants: z.array(z.string()).optional(),
    })
    .optional(),
  content: z.string().optional(), // For meeting summaries that are pre-generated
});

export const createDocument = ({ session, dataStream }: CreateDocumentProps) =>
  tool({
    description:
      'Create a document for writing, content creation, or meeting summaries. For meeting transcripts, use documentType: "meeting-summary" and follow the structured format with "## Topic:" sections.',
    inputSchema: createDocumentSchema,
    execute: async ({ title, kind, documentType, metadata, content }) => {
      const id = generateUUID();
      let finalContent = content;
      let topicsFound: string[] = [];

      // Handle meeting summaries specially
      if (documentType === 'meeting-summary' && content) {
        const validation = validateSummaryStructure(content);
        topicsFound = validation.topics;

        // Add validation warnings if structure is invalid
        if (!validation.isValid) {
          const warnings = validation.errors
            .map((e) => `<!-- Warning: ${e} -->`)
            .join('\n');
          finalContent = `${warnings}\n\n${content}`;
        }

        // Embed metadata as HTML comments
        finalContent = embedMetadataInContent(
          finalContent || content,
          documentType,
          metadata || {},
          topicsFound,
        );
      }

      dataStream.write({
        type: 'data-kind',
        data: kind,
        transient: true,
      });

      dataStream.write({
        type: 'data-id',
        data: id,
        transient: true,
      });

      dataStream.write({
        type: 'data-title',
        data: title,
        transient: true,
      });

      dataStream.write({
        type: 'data-clear',
        data: null,
        transient: true,
      });

      // If we have pre-generated content (meeting summary), write it directly
      if (finalContent) {
        dataStream.write({
          type: 'data-textDelta',
          data: finalContent,
          transient: true,
        });

        // Save the document
        if (session?.user?.id) {
          const { saveDocument } = await import('@/lib/db/queries');
          await saveDocument({
            id,
            title,
            content: finalContent,
            kind: 'text', // Meeting summaries are stored as text
            userId: session.user.id,
          });
        }
      } else {
        // Use the existing document handler system for dynamic generation
        const documentHandler = documentHandlersByArtifactKind.find(
          (documentHandlerByArtifactKind) =>
            documentHandlerByArtifactKind.kind === kind,
        );

        if (!documentHandler) {
          throw new Error(`No document handler found for kind: ${kind}`);
        }

        await documentHandler.onCreateDocument({
          id,
          title,
          dataStream,
          session,
        });
      }

      dataStream.write({ type: 'data-finish', data: null, transient: true });

      return {
        id,
        title,
        kind,
        documentType: documentType || 'general',
        topicsFound: documentType === 'meeting-summary' ? topicsFound : [],
        content:
          documentType === 'meeting-summary'
            ? 'Meeting summary created with extracted topics.'
            : 'A document was created and is now visible to the user.',
      };
    },
  });
