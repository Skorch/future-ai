/**
 * Sales call summary knowledge handler
 */

import type { KnowledgeHandler, GenerateKnowledgeProps } from '../base-handler';
import { generateKnowledgeSummary } from '../base-handler';
import { createKnowledgeBuilder } from '@/lib/ai/prompts/builders';

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
    // Use builder to generate summary prompt with workspace/objective context
    const builder = createKnowledgeBuilder('sales-call-summary');
    const summaryPrompt = builder.generate(
      props.domain,
      props.workspace,
      props.objective,
    );

    return await generateKnowledgeSummary({
      ...props,
      summaryPrompt,
    });
  },
};
