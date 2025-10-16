/**
 * Objective Context Builder
 * Generates system prompts for objective context generation
 */

import type { Objective } from '@/lib/db/schema';
import type { Domain } from '@/lib/domains';
import { OBJECTIVE_CONTEXT_GENERATION_PROMPT } from '../shared/prompts/generation/context.prompts';

export class ObjectiveContextBuilder {
  generate(objective: Objective, domain: Domain): string {
    let prompt = OBJECTIVE_CONTEXT_GENERATION_PROMPT;

    // Add domain-specific guidance
    const domainGuidance = this.getDomainGuidance(domain.id);
    if (domainGuidance) {
      prompt += `\n\n## Domain-Specific Guidance\n\n${domainGuidance}`;
    }

    return prompt;
  }

  private getDomainGuidance(domainId: string): string | null {
    // Map domain ID to domain-specific objective guidance
    switch (domainId) {
      case 'sales':
        return 'Focus on THIS specific deal: stakeholders, budget, timeline, requirements, competition, status, next steps.';
      case 'project':
        return 'Focus on THIS specific project: goals, stakeholders, requirements, architecture, timeline, progress, blockers.';
      default:
        return null;
    }
  }
}
