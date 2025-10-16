/**
 * Unit tests for BuildAgentBuilder
 * Tests composition correctness and context handling
 */

import { describe, it, expect } from 'vitest';
import { BuildAgentBuilder } from '@/lib/ai/prompts/builders/agents/build-agent-builder';
import type { Domain } from '@/lib/domains';
import type { Workspace, Objective } from '@/lib/db/schema';

describe('BuildAgentBuilder', () => {
  // Mock data
  const mockDomain: Domain = {
    id: 'sales',
    label: 'Sales',
    description: 'Sales intelligence',
    defaultDocumentType: 'sales-strategy',
    prompt: 'Sales domain prompt',
    workspaceContextPrompt: 'Workspace guidance',
    workspaceContextPlaceholder: 'Enter workspace context',
    objectiveContextPrompt: 'Objective guidance',
    objectiveContextPlaceholder: 'Enter objective context',
    allowedTypes: ['sales-strategy'],
  };

  const mockWorkspace: Workspace = {
    id: '1',
    userId: 'user-1',
    domainId: 'sales',
    name: 'Test Workspace',
    description: null,
    context: 'This is test workspace context',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockObjective: Objective = {
    id: '1',
    workspaceId: '1',
    userId: 'user-1',
    name: 'Test Objective',
    description: null,
    context: 'This is test objective context',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const builder = new BuildAgentBuilder();

  describe('generate', () => {
    it('should return non-empty string', () => {
      const result = builder.generate(mockDomain, null, null);

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(100);
    });

    it('should include build mode identifier in output', () => {
      const result = builder.generate(mockDomain, null, null);

      // Verify it contains build mode prompt
      expect(result).toContain('Build Mode');
    });

    it('should include system prompt header', () => {
      const result = builder.generate(mockDomain, null, null);

      // Headers typically contain role/identity statements
      expect(result.length).toBeGreaterThan(0);
    });

    it('should include workspace context when workspace provided', () => {
      const result = builder.generate(mockDomain, mockWorkspace, null);

      expect(result).toContain('Workspace Context');
      expect(result).toContain(mockWorkspace.context);
    });

    it('should include objective context when objective provided', () => {
      const result = builder.generate(mockDomain, null, mockObjective);

      expect(result).toContain('Objective Context');
      expect(result).toContain(mockObjective.context);
    });

    it('should include both contexts when both provided', () => {
      const result = builder.generate(mockDomain, mockWorkspace, mockObjective);

      expect(result).toContain('Workspace Context');
      expect(result).toContain(mockWorkspace.context);
      expect(result).toContain('Objective Context');
      expect(result).toContain(mockObjective.context);
    });

    it('should handle null workspace gracefully', () => {
      const result = builder.generate(mockDomain, null, mockObjective);

      // Should not contain workspace section
      expect(result).not.toContain(
        mockWorkspace.context || 'non-existent-marker',
      );
      // Should still be valid output
      expect(result.length).toBeGreaterThan(100);
    });

    it('should handle null objective gracefully', () => {
      const result = builder.generate(mockDomain, mockWorkspace, null);

      // Should not contain objective section
      expect(result).not.toContain(
        mockObjective.context || 'non-existent-marker',
      );
      // Should still be valid output
      expect(result.length).toBeGreaterThan(100);
    });

    it('should handle workspace with null context', () => {
      const workspaceNullContext: Workspace = {
        ...mockWorkspace,
        context: null,
      };

      const result = builder.generate(mockDomain, workspaceNullContext, null);

      // Should not add workspace section if context is null
      expect(result).not.toContain('Workspace Context');
    });

    it('should handle objective with null context', () => {
      const objectiveNullContext: Objective = {
        ...mockObjective,
        context: null,
      };

      const result = builder.generate(mockDomain, null, objectiveNullContext);

      // Should not add objective section if context is null
      expect(result).not.toContain('Objective Context');
    });

    it('should not include discovery mode content', () => {
      const result = builder.generate(mockDomain, null, null);

      // Verify it doesn't contain discovery mode markers
      expect(result).not.toContain('Discovery Mode');
    });
  });
});
