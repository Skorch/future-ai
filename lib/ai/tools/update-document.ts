import { tool, type UIMessageStreamWriter } from 'ai';
import { z } from 'zod';
import { getObjectiveDocumentById } from '@/lib/db/objective-document';
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
      // Only ObjectiveDocuments are editable (KnowledgeDocuments are immutable)
      const docWithVersions = await getObjectiveDocumentById(
        id,
        session.user.id,
      );

      if (
        !docWithVersions ||
        docWithVersions.document.workspaceId !== workspaceId
      ) {
        return {
          error: 'Document not found or access denied',
        };
      }

      // Get latest version
      const currentVersion = docWithVersions.latestVersion;

      if (!currentVersion) {
        return {
          error: 'No version found for document',
        };
      }

      dataStream.write({
        type: 'data-clear',
        data: null,
        transient: true,
      });

      // Load handler from registry based on document's actual type
      // biome-ignore lint/suspicious/noExplicitAny: metadata schema doesn't have typed documentType field yet
      const documentType = ((currentVersion.metadata as any)?.documentType ||
        currentVersion.kind ||
        'text') as DocumentType;
      const documentDef = await getDocumentTypeDefinition(documentType);

      if (!documentDef?.handler) {
        return {
          success: false,
          error: `Unknown document type: ${documentType}`,
          message: `Unable to update document - type "${documentType}" is not supported`,
        };
      }

      // Convert to legacy document format for backward compat with handlers
      const legacyDocument = {
        id: docWithVersions.document.id,
        versionId: currentVersion.id,
        title: docWithVersions.document.title,
        content: currentVersion.content,
        kind: (currentVersion.kind || 'text') as 'text',
        documentType: documentType,
        metadata: currentVersion.metadata,
        createdAt: currentVersion.createdAt,
        workspaceId: docWithVersions.document.workspaceId,
        createdByUserId: currentVersion.createdByUserId,
        isSearchable: false, // ObjectiveDocuments don't have this field
        deletedAt: null,
        sourceDocumentIds: null,
      };

      await documentDef.handler.onUpdateDocument({
        // @ts-ignore - Legacy handler interface
        document: legacyDocument,
        description,
        dataStream,
        session,
        workspaceId,
      });

      dataStream.write({ type: 'data-finish', data: null, transient: true });

      return {
        id,
        title: docWithVersions.document.title,
        kind: (currentVersion.kind || 'text') as 'text',
        content: 'The document has been updated successfully.',
      };
    },
  });
