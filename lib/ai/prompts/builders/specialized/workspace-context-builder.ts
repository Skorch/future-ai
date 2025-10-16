/**
 * Workspace Context Builder
 * Generates system prompts for workspace context generation
 */

import type { Workspace } from '@/lib/db/schema';
import type { Domain } from '@/lib/domains';
import { WORKSPACE_CONTEXT_GENERATION_PROMPT } from '../shared/prompts/generation/context.prompts';

export class WorkspaceContextBuilder {
  generate(workspace: Workspace, domain: Domain): string {
    let prompt = WORKSPACE_CONTEXT_GENERATION_PROMPT;

    // Add domain-specific guidance
    const domainGuidance = this.getDomainGuidance(domain.id);
    if (domainGuidance) {
      prompt += `\n\n## Domain-Specific Guidance\n\n${domainGuidance}`;
    }

    return prompt;
  }

  private getDomainGuidance(domainId: string): string | null {
    // Map domain ID to domain-specific workspace guidance
    switch (domainId) {
      case 'sales':
        return 'Focus on sales process, products, team, and standards. Avoid deal-specific details.';
      case 'project':
        return 'Focus on organization identity, meeting types, team structure, and standards. Avoid project-specific details.';
      default:
        return null;
    }
  }
}
