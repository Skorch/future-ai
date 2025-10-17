/**
 * Unified Agent Builder
 * Generates complete system prompts using the unified agent prompt (no modes)
 * - Base system prompt with capabilities
 * - Domain-specific prompt
 * - Unified agent prompt (replaces mode-specific prompts)
 * - Workspace context (if provided)
 * - Objective context (if provided)
 */

import type { AgentBuilder } from '../factories/agent-builder-factory';
import type { Domain, DomainId } from '@/lib/domains';
import type { Workspace, Objective } from '@/lib/db/schema';
import { composeSystemPrompt } from '@/lib/ai/prompts/system';
import { getUnifiedAgentPrompt } from '../shared/prompts/unified-agent.prompts';

export class UnifiedAgentBuilder implements AgentBuilder {
  async generate(
    domain: Domain,
    workspace: Workspace | null,
    objective: Objective | null,
  ): Promise<string> {
    // 1. Get base + capabilities + domain prompt
    const basePrompt = await composeSystemPrompt({
      domainPrompts: [domain.prompt],
      domainId: domain.id as DomainId,
    });

    // 2. Get unified agent prompt (replaces mode prompts)
    const unifiedPrompt = getUnifiedAgentPrompt();

    // 3. Start with base + unified
    let systemPrompt = `${basePrompt}\n\n${unifiedPrompt}`;

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
