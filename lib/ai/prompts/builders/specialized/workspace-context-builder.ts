import type { ArtifactType, Domain } from '@/lib/db/schema';

export class WorkspaceContextBuilder {
  generateContextPrompt(artifactType: ArtifactType, domain: Domain): string {
    // Start with artifact-specific instructions and template
    let prompt = `## Document Instructions:
${artifactType.instructionPrompt}
## Document Template:
${artifactType.template}

`;

    // Add domain-specific guidance from domain.systemPrompt
    if (domain.systemPrompt) {
      prompt += `\n\n## Domain-Specific Guidance\n\n${domain.systemPrompt}`;
    }

    return prompt;
  }
}
