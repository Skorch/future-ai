/**
 * Business Requirements Document Builder
 * Generates system prompts for BRD documents
 */

import type { DocumentBuilder } from '../types';
import type { Domain } from '@/lib/domains';
import type { Workspace, Objective } from '@/lib/db/schema';
import {
  BRD_PROMPT,
  BRD_TEMPLATE,
} from '../shared/prompts/documents/business-requirements.prompts';

export class BusinessRequirementsDocumentBuilder implements DocumentBuilder {
  generate(
    domain: Domain,
    workspace: Workspace | null,
    objective: Objective | null,
  ): string {
    let systemPrompt = BRD_PROMPT;

    // Add template
    systemPrompt += `\n\n## Required Output Format\n\n${BRD_TEMPLATE}`;

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
