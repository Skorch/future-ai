import { tool } from 'ai';
import type { UIMessageStreamWriter } from 'ai';
import { z } from 'zod';
import type { ChatMessage } from '@/lib/types';
import { ASK_USER_PROMPT } from '@/lib/ai/prompts/builders/shared/prompts/tools/ask-user.prompts';

const askUserSchema = z.object({
  question: z
    .string()
    .describe(
      'Clear, specific question for the user (BLUF - Bottom Line Up Front)',
    ),
  purpose: z
    .string()
    .describe(
      'Why you are asking this question (1-2 sentences explaining the need)',
    ),
  usage: z
    .string()
    .describe(
      'How you will use the answer (1-2 sentences explaining what you will do with the response)',
    ),
  options: z
    .array(
      z.object({
        label: z
          .string()
          .describe(
            'The quick response text (2-8 words, can be more complete than before)',
          ),
        rationale: z
          .string()
          .optional()
          .describe(
            'Brief rationale for this option (1 sentence explaining why this choice makes sense)',
          ),
      }),
    )
    .max(4)
    .optional()
    .describe(
      'Up to 4 quick response options. First option should be your recommended/most likely answer.',
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
      purpose,
      usage,
      options,
    }: z.infer<typeof askUserSchema>) => {
      // Send to UI via dataStream
      dataStream.write({
        type: 'data-askUser',
        data: {
          question,
          purpose,
          usage,
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
