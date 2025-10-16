/**
 * Sales Strategy Document Builder
 * Generates system prompts for sales strategy documents
 */

import type { DocumentBuilder } from '../types';
import type { Domain } from '@/lib/domains';
import type { Workspace, Objective } from '@/lib/db/schema';
import {
  SALES_STRATEGY_PROMPT,
  SALES_STRATEGY_TEMPLATE,
} from '../shared/prompts/documents/sales-strategy.prompts';

export class SalesStrategyDocumentBuilder implements DocumentBuilder {
  generate(
    domain: Domain,
    workspace: Workspace | null,
    objective: Objective | null,
  ): string {
    let systemPrompt = SALES_STRATEGY_PROMPT;

    // Add template
    systemPrompt += `\n\n## Required Output Format\n\n${SALES_STRATEGY_TEMPLATE}`;

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
