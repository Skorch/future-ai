import { tool } from 'ai';
import { z } from 'zod';
import type { UIMessageStreamWriter } from 'ai';
import type { ChatMessage } from '@/lib/types';
import { updateChatMode } from '@/lib/db/queries';

const setModeSchema = z.object({
  mode: z.enum(['discovery', 'build']).describe('The mode to switch to'),
  reason: z.string().describe('Brief explanation for the mode change'),
});

interface SetModeProps {
  chatId: string;
  dataStream: UIMessageStreamWriter<ChatMessage>;
}

export const setMode = ({ chatId, dataStream }: SetModeProps) => {
  return tool({
    description: `Switch between discovery and build modes. You have full autonomy to change modes based on the conversation needs.

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
1. Stop current execution
2. Update available tools
3. Change system prompt focus
4. Allow fresh context on next message`,

    inputSchema: setModeSchema,

    execute: async ({ mode, reason }: z.infer<typeof setModeSchema>) => {
      // Update database directly (per requirement)
      await updateChatMode({ id: chatId, mode });

      // Emit to dataStream for UI updates
      dataStream.write({
        type: 'data-modeChanged',
        data: {
          mode,
          reason,
          timestamp: new Date().toISOString(),
        },
        transient: true,
      });

      // Return structured result that triggers stopWhen
      return {
        success: true,
        mode,
        reason,
        message: `Switching to ${mode} mode: ${reason}`,
      };
    },
  });
};
