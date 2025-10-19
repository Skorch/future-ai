import { CORE_SYSTEM_PROMPT } from '../../system';
import { getCurrentContext } from '@/lib/ai/prompts/current-context';
import type { ArtifactType, Domain, User } from '@/lib/db/schema';

export class WorkspaceContextBuilder {
  generateContextPrompt(
    artifactType: ArtifactType,
    domain: Domain,
    user: User | null,
  ): string {
    // Start with core system prompt and current context
    let prompt = `${CORE_SYSTEM_PROMPT}

${getCurrentContext({ user })}

`;

    // Use database prompt instead of hardcoded
    prompt += artifactType.instructionPrompt;

    // Add domain-specific guidance from domain.systemPrompt
    // (Domain intelligence may include workspace-context-specific rules)
    if (domain.systemPrompt) {
      prompt += `\n\n## Domain-Specific Guidance\n\n${domain.systemPrompt}`;
    }

    return prompt;
  }
}
