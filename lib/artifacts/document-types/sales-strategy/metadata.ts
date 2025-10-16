import type { ArtifactMetadata } from '@/lib/artifacts/types';
import { ThinkingBudget } from '@/lib/artifacts/types';
import { SalesStrategyDocumentBuilder } from '@/lib/ai/prompts/builders/documents/sales-strategy-builder';

export const metadata: ArtifactMetadata = {
  type: 'sales-strategy',
  name: 'Sales Strategy',
  description:
    'Strategic recommendations and probability assessment for sales deals - includes risk analysis, competitive positioning, and tactical next steps',
  clientKind: 'text',
  icon: 'Target',

  builderClass: SalesStrategyDocumentBuilder,

  agentGuidance: {
    when: 'User requests strategic recommendations, deal probability assessment, or asks "what should we do" about a sales opportunity',
    triggers: [
      'sales strategy',
      'deal strategy',
      'what should we do',
      'probability',
      'win rate',
      'close plan',
      'competitive position',
      'deal risk',
      'strategic recommendation',
      'next steps',
    ],
    examples: [
      'What should we do to advance the Mozilla deal?',
      "What's the probability of closing this deal?",
      'Create a strategy for the RexelUSA opportunity',
      'What are the risks with this deal and how do we mitigate them?',
      'How should we position against PHData?',
    ],
  },

  requiredParams: ['sourceDocumentIds'],
  optionalParams: [
    'primarySourceDocumentId',
    'dealName',
    'prospectCompany',
    'specificQuestion',
  ],

  outputSize: 1800, // Strategic recommendations - more concise than analysis
  thinkingBudget: ThinkingBudget.MEDIUM, // 8000 tokens for strategic reasoning
  temperature: 0.4, // Slightly higher than analysis for strategic thinking

  chunkingStrategy: 'section-based',
};
