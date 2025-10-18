/**
 * Objective Document Builder
 * Generic builder for category='objective' documents (sales-strategy, business-requirements, etc.)
 * Uses database-stored prompts via ArtifactType
 */

import type { ArtifactType, Workspace, Objective } from '@/lib/db/schema';

export class ObjectiveDocumentBuilder {
  generate(
    artifactType: ArtifactType,
    workspace: Workspace | null,
    objective: Objective | null,
  ): string {
    // Layer 1: Artifact instructions from database
    let systemPrompt = artifactType.instructionPrompt;

    // Layer 2: Template from database (if exists)
    if (artifactType.template) {
      systemPrompt += `\n\n## Required Output Format\n\n${artifactType.template}`;
    }

    // Layer 3: Workspace context (if exists)
    if (workspace?.context) {
      systemPrompt += `\n\n## Workspace Context\n\n${workspace.context}`;
    }

    // Layer 4: Objective context (if exists)
    if (objective?.context) {
      systemPrompt += `\n\n## Objective Context\n\n${objective.context}`;
    }

    return systemPrompt;
  }
}
