import { generateUUID } from '@/lib/utils';
import { tool, type UIMessageStreamWriter } from 'ai';
import { z } from 'zod';
import type { Session } from 'next-auth';
import {
  artifactKinds,
  documentHandlersByArtifactKind,
} from '@/lib/artifacts/server';
import type { ChatMessage } from '@/lib/types';

interface CreateDocumentProps {
  session: Session;
  dataStream: UIMessageStreamWriter<ChatMessage>;
}

const createDocumentSchema = z.object({
  title: z.string(),
  kind: z.enum(artifactKinds),
  documentType: z
    .enum(['meeting-summary']) // Only summaries via tool, transcripts via direct upload
    .optional()
    .default('meeting-summary'),
  sourceDocumentIds: z
    .array(z.string().uuid())
    .optional()
    .describe('Array of document IDs to use as source for summary'),
  metadata: z
    .object({
      meetingDate: z.string().optional(),
      participants: z.array(z.string()).optional(),
    })
    .optional(),
});

export const createDocument = ({ session, dataStream }: CreateDocumentProps) =>
  tool({
    description: `Create a meeting summary document from source transcript documents.
When you see DOCUMENT_ID markers in the chat, use those IDs in sourceDocumentIds parameter.
This tool creates summaries from uploaded transcripts.`,
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

      // For meeting summaries, sourceDocumentIds are required
      if (documentType === 'meeting-summary' && (!sourceDocumentIds || sourceDocumentIds.length === 0)) {
        throw new Error('Meeting summaries require sourceDocumentIds (transcript document IDs)');
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

      // Use document handlers for all document types
      if (documentType === 'meeting-summary') {
        console.log('[CreateDocument] Using meeting-summary handler');
        // Import the meeting summary handler directly
        const { meetingSummaryHandler } = await import(
          '@/artifacts/meeting-summary/server'
        );

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
