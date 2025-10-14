import { tool } from 'ai';
import type { UIMessageStreamWriter } from 'ai';
import { z } from 'zod';
import { getDocumentTypeDefinition, documentTypes } from '@/lib/artifacts';
import { fetchSourceDocuments } from '@/lib/artifacts/document-types/base-handler';
import { getVersionByChatId } from '@/lib/db/objective-document';
import { db } from '@/lib/db/queries';
import { chat as chatTable } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getLogger } from '@/lib/logger';
import type { ChatMessage } from '@/lib/types';

const logger = getLogger('generate-document-version');

interface ToolContext {
  session: { user: { id: string } };
  dataStream: UIMessageStreamWriter<ChatMessage>;
  workspaceId: string;
  chatId: string;
}

export const generateDocumentVersion = ({
  session,
  dataStream,
  workspaceId,
  chatId,
}: ToolContext) =>
  tool({
    description:
      "Generate document content for the current chat's version. Use this to create or update document content.",

    inputSchema: z.object({
      documentType: z
        .enum(documentTypes as [string, ...string[]])
        .describe('Document type for the objective deliverable'),
      instruction: z
        .string()
        .describe(
          'Instructions for generating the document content from source materials',
        ),
      primarySourceDocumentId: z
        .string()
        .uuid()
        .optional()
        .describe('Main document being analyzed'),
      referenceDocumentIds: z
        .array(z.string().uuid())
        .optional()
        .describe('Supporting documents for context'),
    }),

    execute: async ({
      documentType,
      instruction,
      primarySourceDocumentId,
      referenceDocumentIds,
    }) => {
      const startTime = Date.now();

      try {
        // 1. Get version for this chat
        const version = await getVersionByChatId(chatId);
        if (!version) {
          return {
            success: false,
            error: 'No version found for this chat. Please start a new chat.',
          };
        }

        // 2. Get objectiveId from chat
        const [chatRecord] = await db
          .select({ objectiveId: chatTable.objectiveId })
          .from(chatTable)
          .where(eq(chatTable.id, chatId))
          .limit(1);

        const objectiveId = chatRecord?.objectiveId;
        if (!objectiveId) {
          return {
            success: false,
            error: 'Could not find objective for this chat',
          };
        }

        // 3. Get document handler (documentType is enum-validated at runtime)
        const documentDef = await getDocumentTypeDefinition(
          documentType as Parameters<typeof getDocumentTypeDefinition>[0],
        );
        if (!documentDef?.handler) {
          return {
            success: false,
            error: `Unknown document type: ${documentType}`,
          };
        }

        // 4. Combine source document IDs
        const sourceDocumentIds = [
          ...(primarySourceDocumentId ? [primarySourceDocumentId] : []),
          ...(referenceDocumentIds || []),
        ];

        logger.info('Starting document generation', {
          versionId: version.id,
          documentType,
          sourceCount: sourceDocumentIds.length,
          sourceIds: sourceDocumentIds,
          hasInstruction: !!instruction,
        });

        // 5. Load source documents ONCE (if provided)
        let sourceContent = '';
        if (sourceDocumentIds.length > 0) {
          logger.info('Loading source documents', {
            count: sourceDocumentIds.length,
          });

          sourceContent = await fetchSourceDocuments(
            sourceDocumentIds,
            workspaceId,
          );

          logger.info('Source documents loaded', {
            totalLength: sourceContent.length,
            hasContent: !!sourceContent,
            preview: sourceContent.substring(0, 200),
          });
        } else {
          logger.warn('No source documents provided', {
            documentType,
            instruction: instruction.substring(0, 100),
          });
        }

        // 6. Initialize artifact stream
        dataStream.write({ type: 'data-kind', data: 'text', transient: true });
        dataStream.write({
          type: 'data-id',
          data: version.documentId, // Send document envelope ID for routing
          transient: true,
        });
        dataStream.write({
          type: 'data-title',
          data: 'Document',
          transient: true,
        });
        dataStream.write({ type: 'data-clear', data: null, transient: true });

        // 7. Generate content via handler
        logger.info('Calling handler', {
          handler: documentDef.metadata.type,
          hasSourceContent: !!sourceContent,
          sourceContentLength: sourceContent.length,
        });

        await documentDef.handler.onCreateDocument({
          id: version.id,
          title: 'Document',
          dataStream,
          session,
          workspaceId,
          objectiveId,
          metadata: {
            documentType,
            sourceContent, // ← Pre-loaded text content
            instruction, // ← Single instruction field
            // Keep IDs for audit/metadata purposes only
            sourceDocumentIds,
            primarySourceDocumentId,
          },
        });

        dataStream.write({ type: 'data-finish', data: null, transient: true });

        const duration = Date.now() - startTime;
        logger.info('Content generated successfully', {
          documentId: version.documentId,
          versionId: version.id,
          duration,
        });

        return {
          id: version.documentId, // Document envelope ID (for routing)
          versionId: version.id, // Version ID (for tracking)
          title: 'Document',
          kind: 'text' as const,
          documentType: documentType || 'text',
          success: true,
          message: `Document content has been generated and is displayed above. Use loadDocument to review the full content, then ask the user for feedback.`,
        };
      } catch (error: unknown) {
        const duration = Date.now() - startTime;
        logger.error('Generation failed', { error, duration, chatId });

        return {
          success: false,
          error:
            error instanceof Error ? error.message : 'Unknown error occurred',
        };
      }
    },
  });
