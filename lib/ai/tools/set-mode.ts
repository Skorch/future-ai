import { tool } from 'ai';
import { z } from 'zod';
import type { UIMessageStreamWriter } from 'ai';
import type { ChatMessage } from '@/lib/types';
import { updateChatMode } from '@/lib/db/queries';

const setModeSchema = z.object({
  mode: z.enum(['discovery', 'build']).describe('The mode to switch to'),
  reason: z.string().describe('Brief explanation for the mode change'),
  nextMessage: z
    .string()
    .optional()
    .describe(
      'Optional message to continue with after mode switch for seamless continuity',
    ),
});

interface SetModeProps {
  chatId: string;
  dataStream: UIMessageStreamWriter<ChatMessage>;
}

export const setMode = ({ chatId, dataStream }: SetModeProps) => {
  return tool({
    description: `Switch between discovery and build modes. You have full autonomy to change modes based on the conversation needs.

IMPORTANT: After switching modes, you should CONTINUE working in the new mode immediately. Don't just announce the switch - actually proceed with the task in the new mode.

WHEN TO USE EACH MODE:

Discovery Mode:
- When you need to understand requirements
- When planning work or creating todos
- When the goal isn't clear yet
- When you need to ask many questions
- When you cannot execute yet (no context)

Build Mode:
- When you have enough context to start building
- When you're ready to create documents
- When executing the planned work
- When delivering on requirements

The mode change will:
1. Take effect on the next step (via prepareStep)
2. Update available tools immediately
3. Change system prompt focus
4. Continue seamlessly if nextMessage provided
5. Stop current agent execution for fresh start`,

    inputSchema: setModeSchema,

    execute: async ({
      mode,
      reason,
      nextMessage,
    }: z.infer<typeof setModeSchema>) => {
      console.log(`[setMode] Switching to ${mode} mode: ${reason}`);

      // Update database for persistence across sessions
      await updateChatMode({ id: chatId, mode });

      // Emit UI notification only (no continuation request)
      dataStream.write({
        type: 'data-modeChanged',
        data: {
          mode,
          reason,
          timestamp: new Date().toISOString(),
        },
        transient: true,
      });

      // Note: prepareStep will handle the nextMessage continuation
      // No need to emit data-continuationRequest anymore

      // Return structured result
      // The stopWhen condition in route.ts will halt execution
      return {
        success: true,
        mode,
        reason,
        nextMessage: nextMessage || null, // prepareStep will use this
        message: `Switching to ${mode} mode: ${reason}`,
      };
    },
  });
};
