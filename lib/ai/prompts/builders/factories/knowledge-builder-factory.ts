/**
 * Knowledge Builder Factory
 * Returns the appropriate builder for the knowledge type
 */

import type { KnowledgeBuilder } from '../types';
import { SalesCallSummaryDocumentBuilder } from '../documents/sales-call-summary-builder';
import { RequirementsMeetingSummaryDocumentBuilder } from '../documents/requirements-meeting-summary-builder';

/**
 * Knowledge types that can be generated
 */
export type KnowledgeType =
  | 'sales-call-summary'
  | 'requirements-meeting-summary';

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
