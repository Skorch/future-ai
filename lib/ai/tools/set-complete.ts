import { getLogger } from '@/lib/logger';

const logger = getLogger('SetComplete');
import { tool } from 'ai';
import { z } from 'zod';
import type { UIMessageStreamWriter } from 'ai';
import type { ChatMessage } from '@/lib/types';
import { updateChatCompletion } from '@/lib/db/queries';

const setCompleteSchema = z.object({
  complete: z.boolean().describe('Whether the chat/task is complete'),
  reason: z
    .string()
    .optional()
    .describe('Brief explanation for marking complete/incomplete'),
});

interface SetCompleteProps {
  chatId: string;
  dataStream: UIMessageStreamWriter<ChatMessage>;
}

export const setComplete = ({ chatId, dataStream }: SetCompleteProps) => {
  return tool({
    description: `Mark the current chat/task as complete or incomplete. This helps track when a task has been fully resolved.

WHEN TO MARK COMPLETE:
- All requested tasks have been finished
- User's questions have been fully answered
- Documents have been created and finalized
- No further action is needed

WHEN TO MARK INCOMPLETE:
- Reopening a previously completed task
- New requirements have emerged
- Work needs to continue

This will:
1. Update the database completion status
2. Set/clear completion timestamps appropriately
3. Stop the current agent execution
4. Signal task completion to the UI`,

    inputSchema: setCompleteSchema,

    execute: async ({
      complete,
      reason,
    }: z.infer<typeof setCompleteSchema>) => {
      logger.info(
        `[setComplete] Marking chat ${chatId} as ${complete ? 'complete' : 'incomplete'}${reason ? `: ${reason}` : ''}`,
      );

      // Update database with completion status
      const now = new Date();
      await updateChatCompletion({
        id: chatId,
        complete,
        completedAt: complete ? now : null,
        // Only set firstCompletedAt if it's not already set and we're completing
        firstCompletedAt: complete ? now : undefined, // undefined means don't update
      });

      // Emit to dataStream for UI updates
      // Using data-finish as a notification mechanism (it expects null data)
      if (complete) {
        dataStream.write({
          type: 'data-finish',
          data: null,
          transient: true,
        });
      }

      // Return structured result
      return {
        success: true,
        complete,
        reason: reason || null,
        message: complete
          ? `Task marked as complete${reason ? `: ${reason}` : ''}`
          : `Task marked as incomplete${reason ? `: ${reason}` : ''}`,
      };
    },
  });
};
