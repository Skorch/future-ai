import type { Domain } from '@/lib/domains';
import { WORKSPACE_CONTEXT_GENERATION_PROMPT } from '../shared/prompts/generation/context.prompts';

export class WorkspaceContextBuilder {
  generateContextPrompt(domain: Domain): string {
    let prompt = WORKSPACE_CONTEXT_GENERATION_PROMPT;

    // Add domain-specific guidance from domain configuration
    if (domain.workspaceContextPrompt) {
      prompt += `\n\n## Domain-Specific Guidance\n\n${domain.workspaceContextPrompt}`;
    }

    return prompt;
  }
}
