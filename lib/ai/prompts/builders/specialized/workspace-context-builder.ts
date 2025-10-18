import type { ArtifactType, Domain } from '@/lib/db/schema';

export class WorkspaceContextBuilder {
  generateContextPrompt(artifactType: ArtifactType, domain: Domain): string {
    // Use database prompt instead of hardcoded
    let prompt = artifactType.instructionPrompt;

    // Add domain-specific guidance from domain.systemPrompt
    // (Domain intelligence may include workspace-context-specific rules)
    if (domain.systemPrompt) {
      prompt += `\n\n## Domain-Specific Guidance\n\n${domain.systemPrompt}`;
    }

    return prompt;
  }
}
