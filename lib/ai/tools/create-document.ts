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
      let displayContent = content; // Content to show in UI
      let storageContent = content; // Content to save in DB

      if (documentType === 'meeting-summary' && content) {
        // First, strip any existing metadata comments from the content
        // This ensures we start with clean content
        const metadataRegex =
          /<!-- METADATA START -->[\s\S]*?<!-- METADATA END -->\n*/g;
        const cleanContent = content.replace(metadataRegex, '');

        // Now work with clean content
        displayContent = cleanContent;
        storageContent = cleanContent;

        const validation = validateSummaryStructure(cleanContent);
        topicsFound = validation.topics;

        // Add validation warnings if structure is invalid
        if (!validation.isValid) {
          const warnings = validation.errors
            .map((e) => `<!-- Warning: ${e} -->`)
            .join('\n');
          displayContent = `${warnings}\n\n${cleanContent}`;
          storageContent = `${warnings}\n\n${cleanContent}`;
        }

        // Only add metadata to storage version, not display version
        storageContent = embedMetadataInContent(
          storageContent,
          documentType,
          metadata || {},
          topicsFound,
        );

        // Set finalContent to the storage version
        finalContent = storageContent;
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
      if (documentType === 'meeting-summary' && displayContent) {
        // Send clean content to UI (without metadata comments)
        dataStream.write({
          type: 'data-textDelta',
          data: displayContent, // Send display version without metadata
          transient: true,
        });

        // Save the document with metadata
        try {
          if (session?.user?.id && finalContent) {
            const { saveDocument } = await import('@/lib/db/queries');
            await saveDocument({
              id,
              title,
              content: finalContent, // Save storage version with metadata
              kind: 'text', // Meeting summaries are stored as text
              userId: session.user.id,
            });
          }
        } catch (error) {
          console.error('Failed to save meeting summary document:', error);
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
