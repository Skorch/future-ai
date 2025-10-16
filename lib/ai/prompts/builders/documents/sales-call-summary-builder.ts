/**
 * Sales Call Summary Document Builder
 * Generates system prompts for sales call summary documents
 */

import type { DocumentBuilder } from '../types';
import type { Domain } from '@/lib/domains';
import type { Workspace, Objective } from '@/lib/db/schema';
import { SALES_CALL_SUMMARY_PROMPT } from '../shared/prompts/documents/sales-call-summary.prompts';

export class SalesCallSummaryDocumentBuilder implements DocumentBuilder {
  generate(
    domain: Domain,
    workspace: Workspace | null,
    objective: Objective | null,
  ): string {
    let systemPrompt = SALES_CALL_SUMMARY_PROMPT;

    // Add workspace context if exists
    if (workspace?.context) {
      systemPrompt += `\n\n## Workspace Context\n\n${workspace.context}`;
    }

    // Add objective context if exists
    if (objective?.context) {
      systemPrompt += `\n\n## Objective Context\n\n${objective.context}`;
    }

    return systemPrompt;
  }
}
