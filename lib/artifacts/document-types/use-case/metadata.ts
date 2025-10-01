import {
  OutputSize,
  ThinkingBudget,
  type ArtifactMetadata,
} from '@/lib/artifacts/types';

export const metadata: ArtifactMetadata = {
  type: 'use-case',
  name: 'Business Use Case',
  description:
    'Lightweight business discovery document from workshop transcripts',
  clientKind: 'text',

  prompt: 'Generate a business use case document from workshop transcript',
  template: '', // Will be defined in prompts.ts

  agentGuidance: {
    when: 'User needs to document business requirements and objectives from a workshop or discovery session',
    triggers: [
      'business case',
      'use case',
      'business use case',
      'proposal',
      'ROI analysis',
      'business discovery',
      'workshop summary',
      'discovery document',
    ],
    examples: [
      'Create a business use case from this workshop transcript',
      'Generate a use case document from our discovery meeting',
      "Document the business case from today's workshop",
    ],
  },

  requiredParams: ['sourceDocumentIds'],
  optionalParams: ['clientName', 'documentTitle', 'fathomUrl', 'workshopDate'],

  outputSize: OutputSize.MEDIUM, // 2500 tokens for structured business document
  thinkingBudget: ThinkingBudget.MEDIUM, // 8000 tokens for template parsing and LOE analysis

  chunkingStrategy: 'section-based', // Use section-based chunking for use cases
};
