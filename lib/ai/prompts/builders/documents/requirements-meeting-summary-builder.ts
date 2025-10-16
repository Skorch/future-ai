/**
 * Requirements Meeting Summary Document Builder
 * Generates system prompts for requirements meeting summary documents
 */

import type { DocumentBuilder } from '../factories/document-builder-factory';
import type { Domain } from '@/lib/domains';
import type { Workspace, Objective } from '@/lib/db/schema';
import { REQUIREMENTS_MEETING_SUMMARY_PROMPT } from '../shared/prompts/documents/requirements-meeting-summary.prompts';

export class RequirementsMeetingSummaryDocumentBuilder
  implements DocumentBuilder
{
  generate(
    domain: Domain,
    workspace: Workspace | null,
    objective: Objective | null,
  ): string {
    let systemPrompt = REQUIREMENTS_MEETING_SUMMARY_PROMPT;

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
