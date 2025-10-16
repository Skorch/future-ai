/**
 * Discovery Agent Builder
 * Generates system prompts for discovery mode
 */

import type { AgentBuilder } from '../factories/agent-builder-factory';
import type { Domain } from '@/lib/domains';
import type { Workspace, Objective } from '@/lib/db/schema';
import { getSystemPromptHeader } from '../shared/prompts/system.prompts';
import { DISCOVERY_MODE_PROMPT } from '../shared/prompts/modes/discovery.prompts';

export class DiscoveryAgentBuilder implements AgentBuilder {
  generate(
    domain: Domain,
    workspace: Workspace | null,
    objective: Objective | null,
  ): string {
    // Build minimal ModeContext for prompt function
    // Note: The mode prompt doesn't actually use these values currently,
    // but they're required by the ModeContext type signature
    const modeContext = {
      currentMode: 'discovery' as const,
      goal: null,
      todoList: null,
      modeSetAt: new Date(),
      messageCount: 0,
      workspace: workspace || undefined,
      objective: objective || undefined,
    };

    // Compose prompt sections
    const header = getSystemPromptHeader();
    const modePrompt = DISCOVERY_MODE_PROMPT(modeContext);

    // Start with header and mode prompt
    let systemPrompt = `${header}\n\n${modePrompt}`;

    // Add workspace context if exists
    if (workspace?.context) {
      systemPrompt += `\n\n## Workspace Context\n\n${workspace.context}`;
    }

    // Add objective context if exists
    if (objective?.context) {
      systemPrompt += `\n\n## Objective Context\n\n${objective.context}`;
    }

    return systemPrompt;
  }
}
