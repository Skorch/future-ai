/**
 * Unified Agent Builder
 * Generates complete system prompts using the unified agent prompt (no modes)
 * Composes 6 layers explicitly:
 * 1. Core system prompt (hardcoded - immutable identity and ethics)
 * 2. Current context (dynamic - user info and datetime)
 * 3. Streaming agent prompt (hardcoded - agentic capabilities for multi-turn interactions)
 * 4. Domain intelligence (database - domain.systemPrompt)
 * 5. Workspace context (database - workspace.context)
 * 6. Objective goal (from ObjectiveDocumentVersion.objectiveGoal)
 */

import type { AgentBuilder } from '../factories/agent-builder-factory';
import type { Domain, Workspace, Objective, User } from '@/lib/db/schema';
import { CORE_SYSTEM_PROMPT } from '@/lib/ai/prompts/system';
import { getCurrentContext } from '@/lib/ai/prompts/current-context';
import { getStreamingAgentPrompt } from '../shared/prompts/unified-agent.prompts';

export class UnifiedAgentBuilder implements AgentBuilder {
  async generate(
    domain: Domain,
    workspace: Workspace | null,
    objective: Objective | null,
    user: User | null,
    objectiveGoal?: string | null,
  ): Promise<string> {
    // Layer 1: Core system prompt
    let systemPrompt = CORE_SYSTEM_PROMPT;

    // Layer 2: Current context (user and datetime)
    systemPrompt += `\n\n${getCurrentContext({ user })}`;

    // Layer 3: Streaming agent prompt (agentic capabilities)
    systemPrompt += `\n\n${getStreamingAgentPrompt()}`;

    // Layer 4: Domain intelligence from database
    if (domain.systemPrompt) {
      systemPrompt += `\n\n## Domain Intelligence\n\n${domain.systemPrompt}`;
    }

    // Layer 5: Workspace context (if exists)
    if (workspace?.context) {
      systemPrompt += `\n\n## Workspace Context\n\nUse this context to understand how this team works and their preferences:\n\n${workspace.context}`;
    }

    // Layer 6: Objective goal (if exists)
    if (objectiveGoal) {
      systemPrompt += `\n\n## Objective Goal\n\nUse this goal to understand the current objective and what has been learned so far:\n\n${objectiveGoal}`;
    }

    return systemPrompt;
  }
}
