import type { ArtifactMetadata } from '@/lib/artifacts/types';
import { OutputSize, ThinkingBudget } from '@/lib/artifacts/types';
import {
  SALES_CALL_ANALYSIS_PROMPT,
  SALES_CALL_ANALYSIS_TEMPLATE,
} from './prompts';

export const metadata: ArtifactMetadata = {
  type: 'sales-analysis',
  name: 'Sales Call Analysis',
  description:
    'Strategic sales call analysis with BANT qualification, deal risk assessment, and progress tracking',
  clientKind: 'text',
  icon: 'Handshake',

  prompt: SALES_CALL_ANALYSIS_PROMPT,
  template: SALES_CALL_ANALYSIS_TEMPLATE,

  agentGuidance: {
    when: 'User uploads sales call transcripts or asks to analyze sales conversations for deal progression',
    triggers: [
      'sales call',
      'sales transcript',
      'prospect call',
      'discovery call',
      'BANT',
      'deal analysis',
      'sales analysis',
      'sales summary',
      'qualification',
    ],
    examples: [
      'Analyze this sales call transcript',
      'Create a sales analysis from this discovery call',
      'Summarize this prospect conversation',
      'Extract BANT status from this sales call',
      'Identify deal risks from this transcript',
    ],
  },

  requiredParams: ['sourceDocumentIds'],
  optionalParams: [
    'primarySourceDocumentId',
    'callDate',
    'participants',
    'dealName',
    'prospectCompany',
  ],

  outputSize: OutputSize.MEDIUM, // 2500 tokens
  thinkingBudget: ThinkingBudget.MEDIUM, // 8000 tokens for BANT reasoning

  chunkingStrategy: 'section-based',
};
