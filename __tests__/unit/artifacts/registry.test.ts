import { describe, expect, it } from 'vitest';
import {
  artifactRegistry,
  documentTypes,
  type DocumentType,
} from '@/lib/artifacts';

describe('Artifact Registry', () => {
  describe('Registry Structure', () => {
    it('should contain all registered document types', () => {
      expect(Object.keys(artifactRegistry)).toEqual([
        'text',
        'meeting-analysis',
        'meeting-agenda',
        'meeting-minutes',
        'use-case',
        'business-requirements',
      ]);
    });

    it('should export documentTypes array matching registry keys', () => {
      expect(documentTypes).toEqual([
        'text',
        'meeting-analysis',
        'meeting-agenda',
        'meeting-minutes',
        'use-case',
        'business-requirements',
      ]);
    });

    it('should derive DocumentType from registry keys', () => {
      // This is a type-level test - if it compiles, it passes
      const validType: DocumentType = 'text';
      const validType2: DocumentType = 'meeting-analysis';

      expect(validType).toBe('text');
      expect(validType2).toBe('meeting-analysis');
    });

    it('should have lazy-loading functions for each type', () => {
      expect(typeof artifactRegistry.text).toBe('function');
      expect(typeof artifactRegistry['meeting-analysis']).toBe('function');
      expect(typeof artifactRegistry['meeting-agenda']).toBe('function');
      expect(typeof artifactRegistry['meeting-minutes']).toBe('function');
      expect(typeof artifactRegistry['use-case']).toBe('function');
      expect(typeof artifactRegistry['business-requirements']).toBe('function');
    });
  });

  describe('Metadata Loading', () => {
    it('text metadata should have correct structure', async () => {
      const { metadata } = await import(
        '@/lib/artifacts/document-types/text/metadata'
      );

      expect(metadata.type).toBe('text');
      expect(metadata.name).toBe('Text Document');
      expect(metadata.clientKind).toBe('text');
      expect(metadata).toHaveProperty('prompt');
      expect(metadata).toHaveProperty('agentGuidance');
      expect(metadata).toHaveProperty('chunkingStrategy');
      expect(metadata.chunkingStrategy).toBe('section-based');
    });

    it('meeting-analysis metadata should have correct structure', async () => {
      const { metadata } = await import(
        '@/lib/artifacts/document-types/meeting-analysis/metadata'
      );

      expect(metadata.type).toBe('meeting-analysis');
      expect(metadata.name).toBe('Meeting Analysis');
      expect(metadata.clientKind).toBe('text');
      expect(metadata).toHaveProperty('prompt');
      expect(metadata).toHaveProperty('agentGuidance');
      expect(metadata).toHaveProperty('chunkingStrategy');
      expect(metadata.chunkingStrategy).toBe('section-based');
    });
  });

  describe('Agent Guidance', () => {
    it('text type should have generic triggers', async () => {
      const { metadata } = await import(
        '@/lib/artifacts/document-types/text/metadata'
      );

      expect(metadata.agentGuidance.triggers).toContain('write');
      expect(metadata.agentGuidance.triggers).toContain('document');
      expect(metadata.agentGuidance.examples.length).toBeGreaterThan(0);
    });

    it('meeting-analysis type should have meeting-specific triggers', async () => {
      const { metadata } = await import(
        '@/lib/artifacts/document-types/meeting-analysis/metadata'
      );

      expect(metadata.agentGuidance.triggers).toContain('transcript');
      expect(metadata.agentGuidance.triggers).toContain('meeting summary');
    });
  });

  describe('Type Safety', () => {
    it('documentTypes should only contain valid registry keys', () => {
      for (const type of documentTypes) {
        expect(artifactRegistry).toHaveProperty(type);
      }
    });

    it('should not allow invalid types at compile time', () => {
      // This test validates TypeScript types - if it compiles, it passes
      // @ts-expect-error Invalid type should not compile
      const invalid: DocumentType = 'invalid-type';

      expect(invalid).toBe('invalid-type'); // Runtime check for test runner
    });
  });
});
