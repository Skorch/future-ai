import { tool } from 'ai';
import type { UIMessageStreamWriter } from 'ai';
import { z } from 'zod';
import { getCategoryHandler } from '@/lib/artifacts/category-handlers';
import { getVersionByChatId } from '@/lib/db/objective-document';
import { getLogger } from '@/lib/logger';
import { getObjectiveById } from '@/lib/db/objective';
import type { ChatMessage } from '@/lib/types';

const logger = getLogger('update-objective-actions');

interface ToolContext {
  session: { user: { id: string } };
  dataStream: UIMessageStreamWriter<ChatMessage>;
  workspaceId: string;
  chatId: string;
}

export const updateObjectiveActions = ({
  session,
  dataStream,
  workspaceId,
  chatId,
}: ToolContext) =>
  tool({
    description:
      "Update the objective actions for the current chat's document version based on new knowledge. The objective actions track risks, unknowns, blockers, gaps, and contradictions that need to be resolved. Use this after processing knowledge to show what was resolved, modified, or newly discovered.",

    inputSchema: z.object({
      knowledgeDocumentIds: z
        .array(z.string().uuid())
        .min(1)
        .describe(
          'Knowledge document IDs to process for objective actions updates (e.g., sales call summaries, meeting notes)',
        ),
      instruction: z
        .string()
        .optional()
        .describe(
          'Optional specific instructions for objective actions analysis (e.g., "focus on technical risks")',
        ),
    }),

    execute: async ({
      knowledgeDocumentIds,
      instruction = 'Analyze how this knowledge affects the objective actions items',
    }) => {
      const startTime = Date.now();

      try {
        // 1. Get version and objectiveId for this chat
        const result = await getVersionByChatId(chatId);
        if (!result) {
          return {
            success: false,
            error: 'No version found for this chat. Please start a new chat.',
          };
        }

        const { version, objectiveId } = result;

        logger.info('Starting objective actions update', {
          versionId: version.id,
          objectiveId,
          knowledgeDocCount: knowledgeDocumentIds.length,
        });

        // 2. Get objective to access artifact type ID
        const objective = await getObjectiveById(objectiveId, session.user.id);

        if (!objective) {
          return {
            success: false,
            error: 'Objective not found or access denied',
          };
        }

        // 3. Get category handler for objective actions
        const { handler, artifactType } = await getCategoryHandler(
          objective.objectiveActionsArtifactTypeId,
        );

        logger.info('Using category handler for objective actions', {
          category: handler.category,
          artifactTypeName: artifactType.label,
        });

        // 4. Initialize objective actions stream
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
          data: 'Objective Actions Update',
          transient: true,
        });
        dataStream.write({ type: 'data-clear', data: null, transient: true });

        // 5. Generate objective actions using category handler
        const objectiveActionsContent = await handler.generate(artifactType, {
          currentVersion: version.objectiveActions ?? undefined,
          instruction,
          knowledgeDocIds: knowledgeDocumentIds,
          dataStream,
          workspaceId,
          objectiveId,
          session,
        });

        // 6. Save objective actions to database
        const { updateVersionObjectiveActions } = await import(
          '@/lib/db/objective-document'
        );
        await updateVersionObjectiveActions(
          version.id,
          objectiveActionsContent,
        );

        dataStream.write({ type: 'data-finish', data: null, transient: true });

        const duration = Date.now() - startTime;
        logger.info('Objective actions updated successfully', {
          versionId: version.id,
          duration,
        });

        return {
          id: version.documentId,
          versionId: version.id,
          title: 'Objective Actions Update',
          kind: 'text' as const,
          success: true,
          message: `Objective actions have been updated and are displayed above. Review the changes to see what was resolved, modified, or newly discovered from the knowledge.`,
        };
      } catch (error: unknown) {
        const duration = Date.now() - startTime;
        logger.error('Objective actions update failed', {
          error,
          duration,
          chatId,
        });

        return {
          success: false,
          error:
            error instanceof Error ? error.message : 'Unknown error occurred',
        };
      }
    },
  });
