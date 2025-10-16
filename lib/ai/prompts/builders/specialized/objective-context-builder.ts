import type { Domain } from '@/lib/domains';
import { OBJECTIVE_CONTEXT_GENERATION_PROMPT } from '../shared/prompts/generation/context.prompts';

export class ObjectiveContextBuilder {
  generateContextPrompt(domain: Domain): string {
    let prompt = OBJECTIVE_CONTEXT_GENERATION_PROMPT;

    // Add domain-specific guidance from domain configuration
    if (domain.objectiveContextPrompt) {
      prompt += `\n\n## Domain-Specific Guidance\n\n${domain.objectiveContextPrompt}`;
    }

    return prompt;
  }
}
