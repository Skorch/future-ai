/**
 * Punchlist Builder
 * Generic builder for category='punchlist' generation
 * Uses database-stored prompts via ArtifactType
 */

import type { ArtifactType } from '@/lib/db/schema';

export class PunchlistBuilder {
  generate(
    artifactType: ArtifactType,
    currentPunchlist: string | null,
    currentContent: string,
    knowledgeSummaries: string,
  ): string {
    // Layer 1: Document-specific tracking instructions from database
    let systemPrompt = artifactType.instructionPrompt;

    // Layer 2: Template (formatting rules) from database
    if (artifactType.template) {
      systemPrompt += `\n\n${artifactType.template}`;
    }

    // Layer 3: Current context for incremental updates
    systemPrompt += `\n\n## Current Context

### Current Document Content
${currentContent}

### Current Punchlist
${currentPunchlist || 'No punchlist yet - this is the first knowledge input. Generate an initial punchlist based on the current document content and new knowledge.'}

### New Knowledge to Process
${knowledgeSummaries}

## Your Task
Analyze the new knowledge and update the punchlist to show:
1. Which items are now RESOLVED (knowledge fully addresses them)
2. Which items are MODIFIED (knowledge partially addresses or updates them)
3. NEW items discovered from the knowledge
4. Items that remain unchanged

Always use the full knowledge document title and date for attribution.
At the end, summarize what changed in the "Changes from Knowledge" section.`;

    return systemPrompt;
  }
}
