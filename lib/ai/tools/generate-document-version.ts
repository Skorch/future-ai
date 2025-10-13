import { tool } from 'ai';
import type { UIMessageStreamWriter } from 'ai';
import { z } from 'zod';
import { getDocumentTypeDefinition } from '@/lib/artifacts';
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
        .string()
        .describe(
          'Document type (e.g., business-requirements, sales-proposal)',
        ),
      instruction: z
        .string()
        .describe('Instructions for what content to generate'),
      primarySourceDocumentId: z
        .string()
        .uuid()
        .optional()
        .describe('Main document being analyzed'),
      referenceDocumentIds: z
        .array(z.string().uuid())
        .optional()
        .describe('Supporting documents for context'),
      agentInstruction: z
        .string()
        .optional()
        .describe('Custom generation instructions'),
    }),

    execute: async ({
      documentType,
      instruction,
      primarySourceDocumentId,
      referenceDocumentIds,
      agentInstruction,
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

        // 2. Get objectiveId from chat (simpler than joining through document!)
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

        // 3. Get document handler
        const documentDef = await getDocumentTypeDefinition(
          (documentType || 'text') as Parameters<
            typeof getDocumentTypeDefinition
          >[0],
        );
        if (!documentDef?.handler) {
          return {
            success: false,
            error: `Unknown document type: ${documentType}`,
          };
        }

        // 4. Combine source documents (same pattern as createDocument)
        const sourceDocumentIds = [
          ...(primarySourceDocumentId ? [primarySourceDocumentId] : []),
          ...(referenceDocumentIds || []),
        ];

        logger.debug('Generating content', {
          versionId: version.id,
          documentType,
          sourceCount: sourceDocumentIds.length,
        });

        // 5. Initialize artifact stream
        dataStream.write({ type: 'data-kind', data: 'text', transient: true });
        dataStream.write({
          type: 'data-id',
          data: version.id,
          transient: true,
        });
        dataStream.write({
          type: 'data-title',
          data: 'Document',
          transient: true,
        });
        dataStream.write({ type: 'data-clear', data: null, transient: true });

        // 6. Generate content via handler (reuse existing pattern)
        await documentDef.handler.onCreateDocument({
          id: version.id,
          title: 'Document',
          dataStream,
          session,
          workspaceId,
          objectiveId,
          metadata: {
            sourceDocumentIds,
            primarySourceDocumentId,
            agentInstruction: agentInstruction || instruction,
          },
        });

        dataStream.write({ type: 'data-finish', data: null, transient: true });

        const duration = Date.now() - startTime;
        logger.debug('Content generated', { versionId: version.id, duration });

        return {
          id: version.id,
          title: 'Document',
          kind: 'text' as const,
          documentType: documentType || 'text',
          versionId: version.id,
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
