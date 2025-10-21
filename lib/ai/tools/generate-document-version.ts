import { tool } from 'ai';
import type { UIMessageStreamWriter } from 'ai';
import { z } from 'zod';
import { getDocumentTypeDefinition } from '@/lib/artifacts';
import { fetchSourceDocuments } from '@/lib/artifacts/document-types/base-handler';
import { ThinkingBudget } from '@/lib/artifacts/types';
import { getVersionByChatId } from '@/lib/db/objective-document';
import { getLogger } from '@/lib/logger';
import type { ChatMessage } from '@/lib/types';

const logger = getLogger('generate-document-version');

interface ToolContext {
  session: { user: { id: string } };
  dataStream: UIMessageStreamWriter<ChatMessage>;
  workspaceId: string;
  chatId: string;
  objectiveId: string;
  documentType: string;
}

export const generateDocumentVersion = ({
  session,
  dataStream,
  workspaceId,
  chatId,
  objectiveId,
  documentType,
}: ToolContext) =>
  tool({
    description: `Generate or update document content for the current chat's version.

IMPORTANT: The document type is ALREADY DETERMINED by the objective this chat belongs to.
You do not need to specify the document type - it's automatically retrieved from the objective.

Use this tool when the user asks to:
- "Create a draft"
- "Generate the document"
- "Update the document with new information"
- "Regenerate based on new sources"

The tool will use the objective's document type automatically.`,

    inputSchema: z.object({
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
      instruction,
      primarySourceDocumentId,
      referenceDocumentIds,
    }) => {
      const startTime = Date.now();

      try {
        // 1. Get version for this chat
        const result = await getVersionByChatId(chatId);
        if (!result) {
          return {
            success: false,
            error: 'No version found for this chat. Please start a new chat.',
          };
        }

        const { version } = result;

        // 2. Get document handler (documentType provided by tool context)
        const documentDef = await getDocumentTypeDefinition(
          documentType as Parameters<typeof getDocumentTypeDefinition>[0],
        );
        if (!documentDef?.handler) {
          return {
            success: false,
            error: `Unknown document type: ${documentType}`,
          };
        }

        // 3. Combine source document IDs
        const sourceDocumentIds = [
          ...(primarySourceDocumentId ? [primarySourceDocumentId] : []),
          ...(referenceDocumentIds || []),
        ];

        logger.info('Starting document generation', {
          versionId: version.id,
          documentType,
          objectiveId,
          sourceCount: sourceDocumentIds.length,
          sourceIds: sourceDocumentIds,
          hasInstruction: !!instruction,
        });

        // 4. Load source documents ONCE (if provided)
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

        // 5. Initialize artifact stream
        dataStream.write({ type: 'data-kind', data: 'text', transient: true });
        dataStream.write({
          type: 'data-id',
          data: version.documentId, // Send document envelope ID for routing
          transient: true,
        });
        dataStream.write({
          type: 'data-versionId',
          data: version.id, // Send specific version ID for this chat
          transient: true,
        });
        dataStream.write({
          type: 'data-title',
          data: 'Document',
          transient: true,
        });
        dataStream.write({ type: 'data-clear', data: null, transient: true });

        // 6. Generate content via handler
        logger.info('Calling handler', {
          handler: documentDef.metadata.type,
          hasSourceContent: !!sourceContent,
          sourceContentLength: sourceContent.length,
        });

        await documentDef.handler.onCreateDocument({
          versionId: version.id, // Version ID to update (one chat = one version)
          title: 'Document',
          dataStream,
          session,
          workspaceId,
          metadata: {
            documentType,
            sourceContent, // ← Pre-loaded text content
            instruction, // ← Single instruction field
            // Keep IDs for audit/metadata purposes only
            sourceDocumentIds,
            primarySourceDocumentId,
            objectiveId, // Moved to metadata for context (no longer creates document)
            documentId: version.documentId, // Document envelope ID for reference
            thinkingBudget: ThinkingBudget.HIGH, // 12000 tokens for complex documents
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
