import {
  OutputSize,
  ThinkingBudget,
  type ArtifactMetadata,
} from '@/lib/artifacts/types';

export const metadata: ArtifactMetadata = {
  type: 'meeting-minutes',
  name: 'Meeting Minutes (Email)',
  description:
    'Concise, email-ready meeting minutes optimized for quick scanning and action',
  clientKind: 'text',

  prompt:
    'Create brief, impactful meeting minutes suitable for email distribution',
  template: '', // Will be defined in prompts.ts

  agentGuidance: {
    when: 'User needs to share meeting outcomes via email to stakeholders or team members',
    triggers: [
      'email summary',
      'meeting minutes',
      'email minutes',
      'client summary',
      'stakeholder summary',
      'brief summary',
      'meeting recap',
    ],
    examples: [
      'Create email-ready minutes from this meeting transcript',
      'Generate a brief meeting summary I can send to the client',
      'Prepare meeting minutes for the team email update',
    ],
  },

  requiredParams: ['sourceDocumentIds'],
  optionalParams: ['meetingDate', 'participants', 'emailRecipients'],

  outputSize: OutputSize.SMALL, // Brief for email - max 1500 tokens
  thinkingBudget: ThinkingBudget.LOW, // Focus on extraction and condensation
};
