/**
 * Build Agent Builder
 * Generates complete system prompts for build mode including:
 * - Base system prompt with capabilities
 * - Domain-specific prompt
 * - Build mode prompt
 * - Workspace context (if provided)
 * - Objective context (if provided)
 */

import type { AgentBuilder } from '../factories/agent-builder-factory';
import type { Domain } from '@/lib/domains';
import type { DomainId } from '@/lib/domains';
import type { Workspace, Objective } from '@/lib/db/schema';
import { composeSystemPrompt } from '@/lib/ai/prompts/system';
import { BUILD_MODE_PROMPT } from '../shared/prompts/modes/build.prompts';

export class BuildAgentBuilder implements AgentBuilder {
  async generate(
    domain: Domain,
    workspace: Workspace | null,
    objective: Objective | null,
  ): Promise<string> {
    // Build minimal ModeContext for prompt function
    // Note: The mode prompt doesn't actually use these values currently,
    // but they're required by the ModeContext type signature
    const modeContext = {
      currentMode: 'build' as const,
      goal: null,
      todoList: null,
      modeSetAt: new Date(),
      messageCount: 0,
      workspace: workspace || undefined,
      objective: objective || undefined,
    };

    // 1. Get base + capabilities + domain prompt
    const basePrompt = await composeSystemPrompt({
      domainPrompts: [domain.prompt],
      domainId: domain.id as DomainId,
    });

    // 2. Get mode-specific prompt
    const modePrompt = BUILD_MODE_PROMPT(modeContext);

    // 3. Start with base + mode
    let systemPrompt = `${basePrompt}\n\n${modePrompt}`;

    // 4. Add workspace context if exists
    if (workspace?.context) {
      systemPrompt += `\n\n## Workspace Context\n\nUse this context to understand how this team works and their preferences:\n\n${workspace.context}`;
    }

    // 5. Add objective context if exists
    if (objective?.context) {
      systemPrompt += `\n\n## Objective Context\n\nUse this context to understand the current goal and what has been learned so far:\n\n${objective.context}`;
    }

    return systemPrompt;
  }
}
