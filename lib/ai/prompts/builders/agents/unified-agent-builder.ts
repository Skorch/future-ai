/**
 * Unified Agent Builder
 * Generates complete system prompts using the unified agent prompt (no modes)
 * Composes 5 layers explicitly:
 * 1. Base system prompt (hardcoded - core philosophy)
 * 2. Playbook guidance (hardcoded - workflow instructions)
 * 3. Domain intelligence (database - domain.systemPrompt)
 * 4. Unified agent prompt (hardcoded - replaces mode-specific prompts)
 * 5. Context layers (database - workspace and objective context)
 */

import type { AgentBuilder } from '../factories/agent-builder-factory';
import type { Domain, Workspace, Objective } from '@/lib/db/schema';
import { SYSTEM_PROMPT_BASE, PLAYBOOK_GUIDANCE } from '@/lib/ai/prompts/system';
import { getUnifiedAgentPrompt } from '../shared/prompts/unified-agent.prompts';

export class UnifiedAgentBuilder implements AgentBuilder {
  async generate(
    domain: Domain,
    workspace: Workspace | null,
    objective: Objective | null,
  ): Promise<string> {
    // Layer 1: Base system prompt + playbook guidance
    let systemPrompt = `${SYSTEM_PROMPT_BASE}\n\n${PLAYBOOK_GUIDANCE}`;

    // Layer 2: Domain intelligence from database
    if (domain.systemPrompt) {
      systemPrompt += `\n\n## Domain Intelligence\n\n${domain.systemPrompt}`;
    }

    // Layer 3: Unified agent prompt (replaces mode-specific prompts)
    systemPrompt += `\n\n${getUnifiedAgentPrompt()}`;

    // Layer 4: Workspace context (if exists)
    if (workspace?.context) {
      systemPrompt += `\n\n## Workspace Context\n\nUse this context to understand how this team works and their preferences:\n\n${workspace.context}`;
    }

    // Layer 5: Objective context (if exists)
    if (objective?.context) {
      systemPrompt += `\n\n## Objective Context\n\nUse this context to understand the current goal and what has been learned so far:\n\n${objective.context}`;
    }

    return systemPrompt;
  }
}
