/**
 * Sales call summary knowledge handler
 */

import type { KnowledgeHandler, GenerateKnowledgeProps } from '../base-handler';
import { generateKnowledgeSummary } from '../base-handler';
import { SALES_CALL_SUMMARY_PROMPT } from './prompts';

export const metadata = {
  type: 'sales-call-summary',
  name: 'Sales Call Summary',
  description:
    'Filtered summary of sales calls, focusing on customer needs, objections, and next steps',
};

export const handler: KnowledgeHandler = {
  kind: 'knowledge',
  metadata,
  async onGenerateKnowledge(
    props: Omit<GenerateKnowledgeProps, 'summaryPrompt'>,
  ) {
    return await generateKnowledgeSummary({
      ...props,
      summaryPrompt: SALES_CALL_SUMMARY_PROMPT,
    });
  },
};
