import { MEETING_INTELLIGENCE_PROMPT } from '@/lib/ai/prompts/domains/meeting-intelligence';
import { SALES_INTELLIGENCE_PROMPT } from '@/lib/ai/prompts/domains/sales-intelligence';
import type { DocumentType } from '@/lib/artifacts';

export const DOMAINS = {
  meeting: {
    id: 'meeting' as const,
    label: 'Project',
    description: 'Project & meeting management',
    prompt: MEETING_INTELLIGENCE_PROMPT,
    // All types EXCEPT sales-analysis
    allowedTypes: [
      'meeting-analysis',
      'meeting-agenda',
      'meeting-minutes',
      'text',
      'use-case',
      'business-requirements',
    ] as DocumentType[],
  },
  sales: {
    id: 'sales' as const,
    label: 'Sales',
    description: 'Sales call summaries & strategy',
    prompt: SALES_INTELLIGENCE_PROMPT,
    // ONLY sales-call-summary, sales-strategy + text
    allowedTypes: [
      'sales-call-summary',
      'sales-strategy',
      'text',
    ] as DocumentType[],
  },
} as const;

export const DEFAULT_DOMAIN = 'sales';
export type DomainId = keyof typeof DOMAINS;
export const getDomain = (id?: string | null): (typeof DOMAINS)[DomainId] =>
  DOMAINS[id as DomainId] || DOMAINS[DEFAULT_DOMAIN];
