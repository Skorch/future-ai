import { tool } from 'ai';
import type { UIMessageStreamWriter } from 'ai';
import { z } from 'zod';
import type { ChatMessage } from '@/lib/types';
import { ASK_USER_PROMPT } from '@/lib/ai/prompts/tools/ask-user';

const askUserSchema = z.object({
  question: z.string().describe('Clear, specific question for the user'),
  context: z
    .string()
    .optional()
    .describe(
      'Brief context (1-2 sentences) explaining why you need this information',
    ),
  options: z
    .array(z.string())
    .max(4)
    .optional()
    .describe(
      'Up to 4 quick response options. First option should be your recommended/most likely answer. Keep options concise (2-5 words each)',
    ),
});

interface AskUserProps {
  dataStream: UIMessageStreamWriter<ChatMessage>;
}

export const askUser = ({ dataStream }: AskUserProps) => {
  return tool({
    description: ASK_USER_PROMPT,

    inputSchema: askUserSchema,

    execute: async ({
      question,
      context,
      options,
    }: z.infer<typeof askUserSchema>) => {
      // Send to UI via dataStream
      dataStream.write({
        type: 'data-askUser',
        data: {
          question,
          context,
          options,
        },
      });

      // Return result that triggers stopWhen
      return {
        needUserInput: true,
        question,
        display: 'Waiting for your input...',
      };
    },
  });
};
