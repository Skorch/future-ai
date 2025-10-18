import {
  OutputSize,
  ThinkingBudget,
  type ArtifactMetadata,
} from '@/lib/artifacts/types';

export const metadata: ArtifactMetadata = {
  type: 'business-requirements',
  name: 'Business Requirements Document',
  description:
    'Comprehensive BRD with detailed field definitions and acceptance criteria',
  clientKind: 'text',
  icon: 'FileCheck',

  agentGuidance: {
    when: 'User needs to create formal requirements documentation from discovery sessions',
    triggers: [
      'BRD',
      'business requirements',
      'requirements document',
      'business requirements document',
      'formal requirements',
      'detailed requirements',
      'requirements spec',
    ],
    examples: [
      'Create a BRD from these meeting transcripts',
      'Generate a business requirements document from our discovery sessions',
      'Document the formal requirements from these workshops',
    ],
  },

  requiredParams: ['sourceDocumentIds'],
  optionalParams: ['projectName', 'clientName', 'version'],

  outputSize: OutputSize.LARGE, // 4000 tokens for comprehensive documentation
  thinkingBudget: ThinkingBudget.HIGH, // 12000 tokens for complex synthesis and analysis

  chunkingStrategy: 'section-based', // Use section-based chunking for BRDs
};
