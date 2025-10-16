/**
 * Unit tests for AgentBuilderFactory
 * Tests factory selection logic and correct builder instantiation
 */

import { describe, it, expect } from 'vitest';
import { AgentBuilderFactory } from '@/lib/ai/prompts/builders/factories/agent-builder-factory';
import { DiscoveryAgentBuilder } from '@/lib/ai/prompts/builders/agents/discovery-agent-builder';
import { BuildAgentBuilder } from '@/lib/ai/prompts/builders/agents/build-agent-builder';

describe('AgentBuilderFactory', () => {
  describe('builder', () => {
    it('should return DiscoveryAgentBuilder instance for discovery mode', () => {
      const builder = AgentBuilderFactory.builder('discovery');

      expect(builder).toBeInstanceOf(DiscoveryAgentBuilder);
    });

    it('should return BuildAgentBuilder instance for build mode', () => {
      const builder = AgentBuilderFactory.builder('build');

      expect(builder).toBeInstanceOf(BuildAgentBuilder);
    });

    it('should throw descriptive error for invalid mode', () => {
      // @ts-expect-error - testing invalid mode
      expect(() => AgentBuilderFactory.builder('invalid-mode')).toThrow(
        'Unknown agent mode: invalid-mode',
      );
    });

    it('should return builders that implement AgentBuilder interface', () => {
      const discoveryBuilder = AgentBuilderFactory.builder('discovery');
      const buildBuilder = AgentBuilderFactory.builder('build');

      // Verify interface contract - each builder should have generate method
      expect(typeof discoveryBuilder.generate).toBe('function');
      expect(typeof buildBuilder.generate).toBe('function');
    });
  });
});
