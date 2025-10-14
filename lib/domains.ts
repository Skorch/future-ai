import { MEETING_INTELLIGENCE_PROMPT } from '@/lib/ai/prompts/domains/meeting-intelligence';
import { SALES_INTELLIGENCE_PROMPT } from '@/lib/ai/prompts/domains/sales-intelligence';
import type { DocumentType } from '@/lib/artifacts';

export const DOMAINS = {
  project: {
    id: 'project' as const,
    label: 'Project',
    description: 'Project & meeting management',
    defaultDocumentType: 'business-requirements' as const,
    prompt: MEETING_INTELLIGENCE_PROMPT,
    allowedTypes: ['business-requirements'] as DocumentType[],
  },
  sales: {
    id: 'sales' as const,
    label: 'Sales',
    description: 'Sales call summaries & strategy',
    defaultDocumentType: 'sales-strategy' as const,
    prompt: SALES_INTELLIGENCE_PROMPT,
    allowedTypes: ['sales-strategy'] as DocumentType[],
  },
} as const;

export const DEFAULT_DOMAIN = 'sales';
export type DomainId = keyof typeof DOMAINS;
export const getDomain = (id?: string | null): (typeof DOMAINS)[DomainId] =>
  DOMAINS[id as DomainId] || DOMAINS[DEFAULT_DOMAIN];
