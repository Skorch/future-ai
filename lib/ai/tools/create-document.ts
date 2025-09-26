import { generateUUID } from '@/lib/utils';
import { tool, type UIMessageStreamWriter } from 'ai';
import { z } from 'zod';
import {
  artifactKinds,
  documentHandlersByArtifactKind,
} from '@/lib/artifacts/server';
import type { ChatMessage } from '@/lib/types';
import { getDocumentById } from '@/lib/db/queries';
import { loadAllArtifactDefinitions } from '@/lib/artifacts';
import { getLogger } from '@/lib/logger';

const logger = getLogger('CreateDocument');

interface CreateDocumentProps {
  session: { user: { id: string } };
  dataStream: UIMessageStreamWriter<ChatMessage>;
  workspaceId: string;
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
    logger.warn(
      'Failed to load artifact definitions for tool description',
      error,
    );
    return `Create a meeting summary document from uploaded transcript documents.
IMPORTANT: This tool ONLY creates summaries, not transcripts. Transcripts are created via file upload.
When you see TRANSCRIPT_DOCUMENT markers in the chat, use those document IDs in the sourceDocumentIds parameter.`;
  }
}

export const createDocument = ({
  session,
  dataStream,
  workspaceId,
}: CreateDocumentProps) =>
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
      const startTime = Date.now();
      logger.debug('Tool executed', {
        title,
        kind,
        documentType,
        sourceDocumentIds,
        hasSourceDocs: !!sourceDocumentIds?.length,
        startTime: new Date(startTime).toISOString(),
      });

      const id = generateUUID();
      let isStreamInitialized = false;

      try {
        // sourceDocumentIds is now enforced by schema, no need for runtime check

        // Initialize stream with artifact info
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

        isStreamInitialized = true;

        // Use document handlers for all document types
        if (documentType === 'meeting-summary') {
          logger.debug('Using meeting-summary handler');

          // Fetch transcript content from source documents
          logger.debug(
            'Fetching transcript content from documents:',
            sourceDocumentIds,
          );

          // Validate source documents exist
          let transcriptDocuments: Awaited<
            ReturnType<typeof getDocumentById>
          >[];
          try {
            transcriptDocuments = await Promise.all(
              sourceDocumentIds.map((docId) =>
                getDocumentById({ id: docId, workspaceId }),
              ),
            );

            // Check if any documents are missing
            const missingDocs = transcriptDocuments
              .map((doc, idx) => (!doc ? sourceDocumentIds[idx] : null))
              .filter(Boolean);

            if (missingDocs.length > 0) {
              throw new Error(
                `Source documents not found: ${missingDocs.join(', ')}`,
              );
            }
          } catch (error) {
            logger.error('Error fetching source documents:', error);
            throw new Error(
              `Failed to fetch source documents: ${error instanceof Error ? error.message : 'Unknown error'}`,
            );
          }

          // Import the meeting summary handler directly
          const { meetingSummaryHandler } = await import(
            '@/artifacts/meeting-summary/server'
          );

          const handlerStartTime = Date.now();
          logger.debug('Starting meeting summary handler', {
            elapsedBeforeHandler: Date.now() - startTime,
            handlerStartTime: new Date(handlerStartTime).toISOString(),
          });

          // The handler will fetch transcripts from sourceDocumentIds itself
          // We don't need to pass transcript content at all
          await meetingSummaryHandler.onCreateDocument({
            id,
            title,
            dataStream,
            session,
            workspaceId,
            metadata: {
              sourceDocumentIds: sourceDocumentIds || [],
              meetingDate: metadata?.meetingDate,
              participants: metadata?.participants,
            },
          });
          const handlerDuration = Date.now() - handlerStartTime;
        } else {
          logger.debug(`Using ${kind} document handler`);
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
            workspaceId,
          });
        }

        dataStream.write({ type: 'data-finish', data: null, transient: true });
        logger.debug('Sent data-finish signal');

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

        const totalDuration = Date.now() - startTime;
        logger.debug('Tool returning success', {
          id,
          title,
          documentType: returnValue.documentType,
          messageLength: responseMessage.length,
          totalDuration,
          durationSeconds: (totalDuration / 1000).toFixed(2),
        });

        return returnValue;
      } catch (error) {
        const errorDuration = Date.now() - startTime;
        logger.error('Error during document creation:', error);
        logger.error('Error occurred after', {
          errorDuration,
          durationSeconds: (errorDuration / 1000).toFixed(2),
        });

        // Clean up artifact display on error
        if (isStreamInitialized) {
          // Reset the artifact to idle state with error message
          dataStream.write({
            type: 'data-title',
            data: `Error: ${title}`,
            transient: true,
          });

          dataStream.write({
            type: 'data-finish',
            data: null,
            transient: true,
          });
        }

        // Determine error message based on error type
        let errorMessage =
          'An unexpected error occurred while creating the document';
        let errorDetails = '';

        if (error instanceof Error) {
          if (error.message.includes('Source documents not found')) {
            errorMessage =
              'Unable to create summary: Some source documents could not be found';
            errorDetails = error.message;
          } else if (
            error.message.includes('timeout') ||
            error.message.includes('maxDuration')
          ) {
            errorMessage =
              'Document creation timed out. The summary may be too complex or the source documents too large';
            errorDetails =
              'Consider breaking down the content into smaller sections';
          } else if (error.message.includes('No document handler')) {
            errorMessage = `Unsupported document type: ${kind}`;
            errorDetails = error.message;
          } else {
            errorDetails = error.message;
          }
        }

        // Log full error for debugging
        logger.error('Full error details:', {
          message: errorMessage,
          details: errorDetails,
          error: error instanceof Error ? error.stack : error,
          documentId: id,
          title,
          kind,
          documentType,
          sourceDocumentIds,
        });

        // Return error response that the AI can understand and relay to the user
        return {
          id,
          title,
          kind,
          documentType: documentType || 'meeting-summary',
          sourceDocumentIds: sourceDocumentIds || [],
          success: false,
          error: errorMessage,
          errorDetails,
          message: `I encountered an error while creating the document "${title}". ${errorMessage}. ${errorDetails ? `Details: ${errorDetails}` : ''}`,
        };
      }
    },
  });
