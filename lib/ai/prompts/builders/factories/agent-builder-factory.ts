/**
 * Agent Builder Factory
 * Returns the unified agent builder (MODE system removed in Phase 2)
 */

import type { Workspace, Objective } from '@/lib/db/schema';
import type { Domain } from '@/lib/domains';
import { UnifiedAgentBuilder } from '../agents/unified-agent-builder';

/**
 * Category-specific interface for Agent builders
 * Each builder generates a complete system prompt including:
 * - Base system prompt with capabilities
 * - Domain-specific prompt
 * - Unified agent prompt (no modes)
 * - Workspace context (if provided)
 * - Objective context (if provided)
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
