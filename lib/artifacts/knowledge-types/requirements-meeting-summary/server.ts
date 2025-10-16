/**
 * Requirements meeting summary knowledge handler
 */

import type { KnowledgeHandler, GenerateKnowledgeProps } from '../base-handler';
import { generateKnowledgeSummary } from '../base-handler';
import { createKnowledgeBuilder } from '@/lib/ai/prompts/builders';

export const metadata = {
  type: 'requirements-meeting-summary',
  name: 'Requirements Meeting Summary',
  description:
    'Filtered summary of requirements meetings, focusing on functional/technical requirements and dependencies',
};

export const handler: KnowledgeHandler = {
  kind: 'knowledge',
  metadata,
  async onGenerateKnowledge(
    props: Omit<GenerateKnowledgeProps, 'summaryPrompt'>,
  ) {
    // Use builder to generate summary prompt with workspace/objective context
    const builder = createKnowledgeBuilder('requirements-meeting-summary');
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
