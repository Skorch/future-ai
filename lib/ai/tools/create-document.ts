import { generateUUID } from '@/lib/utils';
import { tool, type UIMessageStreamWriter } from 'ai';
import { z } from 'zod';
import type { Session } from 'next-auth';
import {
  artifactKinds,
  documentHandlersByArtifactKind,
} from '@/lib/artifacts/server';
import type { ChatMessage } from '@/lib/types';
import { getDocumentById } from '@/lib/db/queries';
import { loadAllArtifactDefinitions } from '@/lib/artifacts';

interface CreateDocumentProps {
  session: Session;
  dataStream: UIMessageStreamWriter<ChatMessage>;
}

const createDocumentSchema = z.object({
  title: z.string().describe('Title for the meeting summary document'),
  kind: z.enum(artifactKinds).default('text'),
  documentType: z
    .literal('meeting-summary') // ONLY summaries allowed, no transcripts
    .default('meeting-summary')
    .describe('Document type - only meeting-summary is allowed'),
  sourceDocumentIds: z
    .array(z.string().uuid())
    .min(1, 'At least one source document ID is required for summaries')
    .describe('Array of transcript document IDs to summarize from (required)'),
  metadata: z
    .object({
      meetingDate: z.string().optional(),
      participants: z.array(z.string()).optional(),
    })
    .optional()
    .describe('Optional metadata like meeting date and participants'),
});

// Build dynamic tool description from registry
async function buildToolDescription(): Promise<string> {
  try {
    const definitions = await loadAllArtifactDefinitions();
    const descriptions = definitions
      .map((d) => `- ${d.metadata.type}: ${d.metadata.description}`)
      .join('\n');

    return `Create documents of various types. Available types:\n${descriptions}\n\nUse the appropriate documentType based on the user's request.`;
  } catch (error) {
    console.warn(
      'Failed to load artifact definitions for tool description',
      error,
    );
    return `Create a meeting summary document from uploaded transcript documents.
IMPORTANT: This tool ONLY creates summaries, not transcripts. Transcripts are created via file upload.
When you see TRANSCRIPT_DOCUMENT markers in the chat, use those document IDs in the sourceDocumentIds parameter.`;
  }
}

export const createDocument = ({ session, dataStream }: CreateDocumentProps) =>
  tool({
    description: `Create a meeting summary document from uploaded transcript documents.
IMPORTANT: This tool ONLY creates summaries, not transcripts. Transcripts are created via file upload.
When you see TRANSCRIPT_DOCUMENT markers in the chat, use those document IDs in the sourceDocumentIds parameter.
The sourceDocumentIds parameter is REQUIRED - you must provide at least one transcript document ID.`,
    inputSchema: createDocumentSchema,
    execute: async ({
      title,
      kind,
      documentType,
      sourceDocumentIds,
      metadata,
    }) => {
      console.log('[CreateDocument] Tool executed', {
        title,
        kind,
        documentType,
        sourceDocumentIds,
        hasSourceDocs: !!sourceDocumentIds?.length,
      });

      const id = generateUUID();

      // sourceDocumentIds is now enforced by schema, no need for runtime check

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

      // Use document handlers for all document types
      if (documentType === 'meeting-summary') {
        console.log('[CreateDocument] Using meeting-summary handler');

        // Fetch transcript content from source documents
        console.log(
          '[CreateDocument] Fetching transcript content from documents:',
          sourceDocumentIds,
        );
        const transcriptDocuments = await Promise.all(
          sourceDocumentIds.map((docId) => getDocumentById({ id: docId })),
        );

        // Import the meeting summary handler directly
        const { meetingSummaryHandler } = await import(
          '@/artifacts/meeting-summary/server'
        );

        // The handler will fetch transcripts from sourceDocumentIds itself
        // We don't need to pass transcript content at all
        await meetingSummaryHandler.onCreateDocument({
          id,
          title,
          dataStream,
          session,
          metadata: {
            sourceDocumentIds: sourceDocumentIds || [],
            meetingDate: metadata?.meetingDate,
            participants: metadata?.participants,
          },
        });
        console.log('[CreateDocument] Meeting summary handler completed');
      } else {
        console.log(`[CreateDocument] Using ${kind} document handler`);
        // Use the existing document handler system for other types
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
        console.log(`[CreateDocument] ${kind} handler completed`);
      }

      dataStream.write({ type: 'data-finish', data: null, transient: true });
      console.log('[CreateDocument] Sent data-finish signal');

      // Return a clear message that prompts the AI to respond
      const responseMessage = `I've created a meeting summary titled "${title}". The summary is now displayed above.`;

      const returnValue = {
        id,
        title,
        kind,
        documentType: 'meeting-summary',
        sourceDocumentIds: sourceDocumentIds || [],
        message: responseMessage,
        success: true,
      };

      console.log('[CreateDocument] Tool returning', {
        id,
        title,
        documentType: returnValue.documentType,
        messageLength: responseMessage.length,
      });

      return returnValue;
    },
  });
