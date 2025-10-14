import { tool } from 'ai';
import type { UIMessageStreamWriter } from 'ai';
import { z } from 'zod';
import { getDocumentTypeDefinition, documentTypes } from '@/lib/artifacts';
import { getVersionByChatId } from '@/lib/db/objective-document';
import { getLogger } from '@/lib/logger';
import type { ChatMessage } from '@/lib/types';

const logger = getLogger('update-punchlist');

interface ToolContext {
  session: { user: { id: string } };
  dataStream: UIMessageStreamWriter<ChatMessage>;
  workspaceId: string;
  chatId: string;
}

export const updatePunchlist = ({
  session,
  dataStream,
  workspaceId,
  chatId,
}: ToolContext) =>
  tool({
    description:
      "Update the punchlist for the current chat's document version based on new knowledge. The punchlist tracks risks, unknowns, blockers, gaps, and contradictions that need to be resolved. Use this after processing knowledge to show what was resolved, modified, or newly discovered.",

    inputSchema: z.object({
      documentType: z
        .enum(documentTypes as [string, ...string[]])
        .describe(
          'Document type (must match the document being tracked - e.g., business-requirements, sales-strategy)',
        ),
      knowledgeDocumentIds: z
        .array(z.string().uuid())
        .min(1)
        .describe(
          'Knowledge document IDs to process for punchlist updates (e.g., sales call summaries, meeting notes)',
        ),
      instruction: z
        .string()
        .optional()
        .describe(
          'Optional specific instructions for punchlist analysis (e.g., "focus on technical risks")',
        ),
    }),

    execute: async ({
      documentType,
      knowledgeDocumentIds,
      instruction = 'Analyze how this knowledge affects the punchlist items',
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

        logger.info('Starting punchlist update', {
          versionId: version.id,
          documentType,
          knowledgeDocCount: knowledgeDocumentIds.length,
        });

        // 2. Get document handler
        const documentDef = await getDocumentTypeDefinition(
          documentType as Parameters<typeof getDocumentTypeDefinition>[0],
        );
        if (!documentDef?.handler) {
          return {
            success: false,
            error: `Unknown document type: ${documentType}`,
          };
        }

        // 3. Check if handler supports punchlist generation
        if (!documentDef.handler.onGeneratePunchlist) {
          return {
            success: false,
            error: `Document type ${documentType} doesn't support punchlist tracking`,
          };
        }

        // 4. Initialize punchlist stream
        dataStream.write({
          type: 'data-kind',
          data: 'text',
          transient: true,
        });
        dataStream.write({
          type: 'data-id',
          data: version.id,
          transient: true,
        });
        dataStream.write({
          type: 'data-title',
          data: 'Punchlist Update',
          transient: true,
        });
        dataStream.write({ type: 'data-clear', data: null, transient: true });

        logger.info('Calling punchlist handler', {
          handler: documentDef.metadata.type,
          knowledgeDocIds: knowledgeDocumentIds,
        });

        // 5. Generate punchlist via handler
        await documentDef.handler.onGeneratePunchlist({
          currentVersion: version,
          knowledgeDocIds: knowledgeDocumentIds,
          instruction,
          dataStream,
          workspaceId,
          session,
        });

        dataStream.write({ type: 'data-finish', data: null, transient: true });

        const duration = Date.now() - startTime;
        logger.info('Punchlist updated successfully', {
          versionId: version.id,
          duration,
        });

        return {
          id: version.documentId,
          versionId: version.id,
          title: 'Punchlist Update',
          kind: 'text' as const,
          documentType: documentType || 'text',
          success: true,
          message: `Punchlist has been updated and is displayed above. Review the changes to see what was resolved, modified, or newly discovered from the knowledge.`,
        };
      } catch (error: unknown) {
        const duration = Date.now() - startTime;
        logger.error('Punchlist update failed', { error, duration, chatId });

        return {
          success: false,
          error:
            error instanceof Error ? error.message : 'Unknown error occurred',
        };
      }
    },
  });
