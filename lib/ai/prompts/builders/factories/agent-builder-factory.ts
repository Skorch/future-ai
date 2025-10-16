/**
 * Agent Builder Factory
 * Returns the appropriate builder for the current agent mode
 */

import type { ChatMode, Workspace, Objective } from '@/lib/db/schema';
import type { Domain } from '@/lib/domains';
import { DiscoveryAgentBuilder } from '../agents/discovery-agent-builder';
import { BuildAgentBuilder } from '../agents/build-agent-builder';

/**
 * Category-specific interface for Agent builders
 * Each builder generates a complete system prompt including:
 * - Base system prompt with capabilities
 * - Domain-specific prompt
 * - Mode-specific prompt
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
 * Factory function for creating agent builders based on mode
 */
export function createAgentBuilder(mode: ChatMode): AgentBuilder {
  switch (mode) {
    case 'discovery':
      return new DiscoveryAgentBuilder();
    case 'build':
      return new BuildAgentBuilder();
    default:
      throw new Error(`Unknown agent mode: ${mode}`);
  }
}
