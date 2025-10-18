/**
 * Agent Builder Factory
 * Returns the unified agent builder (MODE system removed in Phase 2)
 */

import type { Domain, Workspace, Objective } from '@/lib/db/schema';
import { UnifiedAgentBuilder } from '../agents/unified-agent-builder';

/**
 * Category-specific interface for Agent builders
 * Each builder generates a complete system prompt including:
 * - Base system prompt (hardcoded - core philosophy)
 * - Playbook guidance (hardcoded - workflow instructions)
 * - Domain intelligence (database - domain.systemPrompt)
 * - Unified agent prompt (hardcoded - replaces mode-specific prompts)
 * - Context layers (database - workspace and objective context)
 */
export interface AgentBuilder {
  generate(
    domain: Domain,
    workspace: Workspace | null,
    objective: Objective | null,
  ): Promise<string>;
}

/**
 * Factory function for creating agent builders
 * Returns unified builder (MODE system removed)
 */
export function createAgentBuilder(): AgentBuilder {
  return new UnifiedAgentBuilder();
}
