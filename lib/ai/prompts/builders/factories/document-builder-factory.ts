/**
 * Document Builder Factory
 * Returns the appropriate builder for the document type
 */

import type { DocumentType } from '@/lib/artifacts';
import type { Domain } from '@/lib/domains';
import type { Workspace, Objective } from '@/lib/db/schema';
import { SalesStrategyDocumentBuilder } from '../documents/sales-strategy-builder';
import { BusinessRequirementsDocumentBuilder } from '../documents/business-requirements-builder';

/**
 * Category-specific interface for Document builders
 * Each builder generates a complete system prompt
 */
export interface DocumentBuilder {
  generate(
    domain: Domain,
    workspace: Workspace | null,
    objective: Objective | null,
  ): string;
}

/**
 * Factory function for creating document builders based on document type
 */
export function createDocumentBuilder(
  documentType: DocumentType,
): DocumentBuilder {
  switch (documentType) {
    case 'sales-strategy':
      return new SalesStrategyDocumentBuilder();
    case 'business-requirements':
      return new BusinessRequirementsDocumentBuilder();
    default:
      throw new Error(`Unknown document type: ${documentType}`);
  }
}
