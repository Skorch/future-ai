/**
 * Unit tests for SalesStrategyDocumentBuilder
 * Tests composition correctness and context handling
 */

import { describe, it, expect } from 'vitest';
import { SalesStrategyDocumentBuilder } from '@/lib/ai/prompts/builders/documents/sales-strategy-builder';
import type { Domain } from '@/lib/domains';
import type { Workspace, Objective } from '@/lib/db/schema';

describe('SalesStrategyDocumentBuilder', () => {
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

  const builder = new SalesStrategyDocumentBuilder();

  describe('generate', () => {
    it('should return non-empty string', () => {
      const result = builder.generate(mockDomain, null, null);

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(100);
    });

    it('should include sales strategy prompt content', () => {
      const result = builder.generate(mockDomain, null, null);

      // Verify sales strategy specific content
      expect(result).toContain('strategic sales advisor');
    });

    it('should include required output format section', () => {
      const result = builder.generate(mockDomain, null, null);

      expect(result).toContain('Required Output Format');
    });

    it('should include sales strategy template', () => {
      const result = builder.generate(mockDomain, null, null);

      // Template markers
      expect(result).toContain('Sales Strategy Recommendation');
      expect(result).toContain('Deal Probability');
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

    it('should not include BRD-specific content', () => {
      const result = builder.generate(mockDomain, null, null);

      // Verify it doesn't contain business requirements content
      expect(result).not.toContain('Business Requirements Document');
      expect(result).not.toContain('Stakeholders');
    });

    it('should include all required sections in correct order', () => {
      const result = builder.generate(mockDomain, mockWorkspace, mockObjective);

      // Find positions of key sections
      const promptPos = result.indexOf('strategic sales advisor');
      const formatPos = result.indexOf('Required Output Format');
      const workspacePos = result.indexOf('Workspace Context');
      const objectivePos = result.indexOf('Objective Context');

      // Verify order: prompt -> format -> workspace -> objective
      expect(promptPos).toBeLessThan(formatPos);
      expect(formatPos).toBeLessThan(workspacePos);
      expect(workspacePos).toBeLessThan(objectivePos);
    });
  });
});
