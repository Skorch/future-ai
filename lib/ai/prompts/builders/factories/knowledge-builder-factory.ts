/**
 * Knowledge Builder Factory
 * Returns the appropriate builder for the knowledge type
 */

import type { Domain } from '@/lib/domains';
import type { Workspace, Objective } from '@/lib/db/schema';
import { SalesCallSummaryDocumentBuilder } from '../documents/sales-call-summary-builder';
import { RequirementsMeetingSummaryDocumentBuilder } from '../documents/requirements-meeting-summary-builder';

/**
 * Knowledge types that can be generated
 */
export type KnowledgeType =
  | 'sales-call-summary'
  | 'requirements-meeting-summary';

/**
 * Category-specific interface for Knowledge builders
 * Each builder generates a complete system prompt
 */
export interface KnowledgeBuilder {
  generate(
    domain: Domain,
    workspace: Workspace | null,
    objective: Objective | null,
  ): string;
}

/**
 * Factory function for creating knowledge builders based on knowledge type
 */
export function createKnowledgeBuilder(
  knowledgeType: KnowledgeType,
): KnowledgeBuilder {
  switch (knowledgeType) {
    case 'sales-call-summary':
      return new SalesCallSummaryDocumentBuilder();
    case 'requirements-meeting-summary':
      return new RequirementsMeetingSummaryDocumentBuilder();
    default:
      throw new Error(`Unknown knowledge type: ${knowledgeType}`);
  }
}
