/**
 * Requirements meeting summary knowledge handler
 */

import type { KnowledgeHandler, GenerateKnowledgeProps } from '../base-handler';
import { generateKnowledgeSummary } from '../base-handler';
import { REQUIREMENTS_MEETING_SUMMARY_PROMPT } from './prompts';

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
    return await generateKnowledgeSummary({
      ...props,
      summaryPrompt: REQUIREMENTS_MEETING_SUMMARY_PROMPT,
    });
  },
};
