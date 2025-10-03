import type { ArtifactMetadata } from '@/lib/artifacts/types';
import { ThinkingBudget } from '@/lib/artifacts/types';
import {
  SALES_CALL_ANALYSIS_PROMPT,
  SALES_CALL_ANALYSIS_TEMPLATE,
} from './prompts';

export const metadata: ArtifactMetadata = {
  type: 'sales-analysis',
  name: 'Sales Call Analysis',
  description:
    'Two-tier sales analysis: executive dashboard + detailed narrative with BANT-C qualification, historical progression, and competitive intelligence',
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

  outputSize: 2200, // Increased for two-tier format (was 1500)
  thinkingBudget: ThinkingBudget.MEDIUM, // 8000 tokens for BANT reasoning
  temperature: 0.3, // Lower temperature for consistent, factual analysis

  chunkingStrategy: 'section-based',
};
