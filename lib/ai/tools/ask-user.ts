import { tool } from 'ai';
import type { UIMessageStreamWriter } from 'ai';
import { z } from 'zod';
import type { ChatMessage } from '@/lib/types';

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
    description: `ALWAYS use this tool when you need user input or clarification. This is your primary method for asking questions - do not just write questions in your response text.

  USE IMMEDIATELY WHEN:
  - User says "ask me questions", "what do you need to know", or similar
  - You're gathering requirements or understanding needs
  - You need to choose between multiple valid approaches
  - Critical details are missing to complete a task
  - You encounter ambiguous or conflicting information

  REQUIRED USE CASES:
  - Requirements gathering (ALWAYS use for this, never just ask in text)
  - Conflicting requirements need resolution
  - Missing critical information blocks progress
  - Major decisions affect project direction
  - User preferences will significantly impact approach
  - Need confirmation on priorities from stakeholders
  - Validation of assumptions about user needs
  - Review of completed deliverables before proceeding

  QUICK OPTIONS GUIDELINES:
  - Provide 2-4 options when there are clear, discrete choices
  - First option = your recommended/most likely answer (will show with ⭐)
  - Keep options short (2-5 words) for button display
  - Don't use options for open-ended questions
  - Options should be mutually exclusive choices

  GOOD EXAMPLES:
  ✅ "Which team should I prioritize for the dashboard requirements?"
     Options: ["Sales team", "Engineering", "Customer Success", "All equally"]
  ✅ "What format do you prefer for the weekly report?"
     Options: ["Dashboard", "PDF report", "Slide deck", "Email summary"]
  ✅ "Should I include historical data in the analysis?"
     Options: ["Yes, last 30 days", "Yes, last quarter", "No, current only", "Let me specify"]

  BAD EXAMPLES:
  ❌ Using for minor decisions you can make yourself
  ❌ Asking multiple questions at once (ask them sequentially instead)
  ❌ Options that are too long or complex for buttons
  ❌ Technical implementation details that don't need PM input

  The user's response will be provided as their next message, allowing you to continue the conversation naturally.`,

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
