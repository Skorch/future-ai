/**
 * Objective Actions Builder
 * Generic builder for category='punchlist' generation
 * Uses database-stored prompts via ArtifactType
 */

import type { ArtifactType } from '@/lib/db/schema';

export class ObjectiveActionsBuilder {
  generate(artifactType: ArtifactType): string {
    // Layer 1: Document-specific tracking instructions from database
    let systemPrompt = artifactType.instructionPrompt;

    // Layer 2: Template (formatting rules) from database
    if (artifactType.template) {
      systemPrompt += `\n\n${artifactType.template}`;
    }

    return systemPrompt;
  }
}
