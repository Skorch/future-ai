/**
 * Unit tests for DocumentBuilderFactory
 * Tests factory selection logic and correct builder instantiation
 */

import { describe, it, expect } from 'vitest';
import { DocumentBuilderFactory } from '@/lib/ai/prompts/builders/factories/document-builder-factory';
import { SalesStrategyDocumentBuilder } from '@/lib/ai/prompts/builders/documents/sales-strategy-builder';
import { BusinessRequirementsDocumentBuilder } from '@/lib/ai/prompts/builders/documents/business-requirements-builder';

describe('DocumentBuilderFactory', () => {
  describe('builder', () => {
    it('should return SalesStrategyDocumentBuilder instance for sales-strategy type', () => {
      const builder = DocumentBuilderFactory.builder('sales-strategy');

      expect(builder).toBeInstanceOf(SalesStrategyDocumentBuilder);
    });

    it('should return BusinessRequirementsDocumentBuilder instance for business-requirements type', () => {
      const builder = DocumentBuilderFactory.builder('business-requirements');

      expect(builder).toBeInstanceOf(BusinessRequirementsDocumentBuilder);
    });

    it('should throw descriptive error for invalid document type', () => {
      // @ts-expect-error - testing invalid document type
      expect(() => DocumentBuilderFactory.builder('invalid-type')).toThrow(
        'Unknown document type: invalid-type',
      );
    });

    it('should return builders that implement DocumentBuilder interface', () => {
      const salesBuilder = DocumentBuilderFactory.builder('sales-strategy');
      const brdBuilder = DocumentBuilderFactory.builder(
        'business-requirements',
      );

      // Verify interface contract - each builder should have generate method
      expect(typeof salesBuilder.generate).toBe('function');
      expect(typeof brdBuilder.generate).toBe('function');
    });
  });
});
