/**
 * Agent Builder Factory
 * Returns the unified agent builder (MODE system removed in Phase 2)
 */

import type { Domain, Workspace, Objective, User } from '@/lib/db/schema';
import { UnifiedAgentBuilder } from '../agents/unified-agent-builder';

/**
 * Category-specific interface for Agent builders
 * Each builder generates a complete system prompt using 6 layers:
 * 1. Core system prompt (hardcoded - immutable identity and ethics)
 * 2. Current context (dynamic - user info and datetime)
 * 3. Streaming agent prompt (hardcoded - agentic capabilities for multi-turn interactions)
 * 4. Domain intelligence (database - domain.systemPrompt)
 * 5. Workspace context (database - workspace.context)
 * 6. Objective context (database - objective.context)
 */
export interface AgentBuilder {
  generate(
    domain: Domain,
    workspace: Workspace | null,
    objective: Objective | null,
    user: User | null,
  ): Promise<string>;
}

/**
 * Factory function for creating agent builders
 * Returns unified builder (MODE system removed)
 */
export function createAgentBuilder(): AgentBuilder {
  return new UnifiedAgentBuilder();
}
