import { tool, type UIMessageStreamWriter } from 'ai';
import { z } from 'zod';
import { getDocumentById } from '@/lib/db/documents';
import { getDocumentTypeDefinition, type DocumentType } from '@/lib/artifacts';
import type { ChatMessage } from '@/lib/types';

interface UpdateDocumentProps {
  session: { user: { id: string } };
  dataStream: UIMessageStreamWriter<ChatMessage>;
  workspaceId: string;
}

export const updateDocument = ({
  session,
  dataStream,
  workspaceId,
}: UpdateDocumentProps) =>
  tool({
    description:
      'Update a document when the user requests specific changes. Do not use this to improve your own work unless explicitly asked.',
    inputSchema: z.object({
      id: z.string().describe('The ID of the document to update'),
      description: z
        .string()
        .describe('The description of changes that need to be made'),
    }),
    execute: async ({ id, description }) => {
      const document = await getDocumentById({ id, workspaceId });

      if (!document) {
        return {
          error: 'Document not found',
        };
      }

      dataStream.write({
        type: 'data-clear',
        data: null,
        transient: true,
      });

      // Load handler from registry based on document's actual type
      // Extract documentType from metadata, fallback to kind, then to 'text'
      const documentType = (document.metadata?.documentType ||
        document.kind ||
        'text') as DocumentType;
      const documentDef = await getDocumentTypeDefinition(documentType);

      if (!documentDef?.handler) {
        return {
          success: false,
          error: `Unknown document type: ${documentType}`,
          message: `Unable to update document - type "${documentType}" is not supported`,
        };
      }

      await documentDef.handler.onUpdateDocument({
        document,
        description,
        dataStream,
        session,
        workspaceId,
      });

      dataStream.write({ type: 'data-finish', data: null, transient: true });

      return {
        id,
        title: document.title,
        kind: document.kind,
        content: 'The document has been updated successfully.',
      };
    },
  });
