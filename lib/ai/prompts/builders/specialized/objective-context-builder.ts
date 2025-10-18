import type { ArtifactType, Domain } from '@/lib/db/schema';

export class ObjectiveContextBuilder {
  generateContextPrompt(artifactType: ArtifactType, domain: Domain): string {
    // Use database prompt instead of hardcoded
    let prompt = artifactType.instructionPrompt;

    // Add domain-specific guidance from domain.systemPrompt
    if (domain.systemPrompt) {
      prompt += `\n\n## Domain-Specific Guidance\n\n${domain.systemPrompt}`;
    }

    return prompt;
  }
}
