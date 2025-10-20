/**
 * Requirements meeting summary knowledge handler
 */

import type { KnowledgeHandler, GenerateKnowledgeProps } from '../base-handler';
import { generateKnowledgeSummary } from '../base-handler';
import { SummaryBuilder } from '@/lib/ai/prompts/builders';

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
    // Use SummaryBuilder to generate summary prompt from artifact type
    const builder = new SummaryBuilder();
    const summaryPrompt = builder.generate(
      props.artifactType,
      props.workspace,
      props.objective,
      props.objectiveGoal,
    );

    return await generateKnowledgeSummary({
      ...props,
      summaryPrompt,
    });
  },
};
