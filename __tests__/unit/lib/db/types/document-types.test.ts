import { describe, it, expect } from 'vitest';
import {
  RAW_DOCUMENT_TYPES,
  KNOWLEDGE_DOCUMENT_TYPES,
  RawDocumentTypeSchema,
  KnowledgeDocumentTypeSchema,
  DocumentTypeSchema,
  isRawDocumentType,
  isKnowledgeDocumentType,
  isValidDocumentType,
  getDocumentTypeLabel,
  RAW_DOCUMENT_TYPE_LABELS,
  KNOWLEDGE_DOCUMENT_TYPE_LABELS,
} from '@/lib/db/types/document-types';

describe('document-types', () => {
  describe('RAW_DOCUMENT_TYPES', () => {
    it('should have all expected raw document types', () => {
      expect(RAW_DOCUMENT_TYPES.TRANSCRIPT).toBe('transcript');
      expect(RAW_DOCUMENT_TYPES.EMAIL).toBe('email');
      expect(RAW_DOCUMENT_TYPES.SLACK).toBe('slack');
      expect(RAW_DOCUMENT_TYPES.MEETING_NOTES).toBe('meeting_notes');
      expect(RAW_DOCUMENT_TYPES.RESEARCH).toBe('research');
      expect(RAW_DOCUMENT_TYPES.OTHER).toBe('other');
    });

    it('should have exactly 6 raw types', () => {
      expect(Object.keys(RAW_DOCUMENT_TYPES)).toHaveLength(6);
    });
  });

  describe('KNOWLEDGE_DOCUMENT_TYPES', () => {
    it('should have all expected knowledge document types', () => {
      expect(KNOWLEDGE_DOCUMENT_TYPES.TEXT).toBe('text');
      expect(KNOWLEDGE_DOCUMENT_TYPES.MEETING_ANALYSIS).toBe(
        'meeting-analysis',
      );
      expect(KNOWLEDGE_DOCUMENT_TYPES.MEETING_AGENDA).toBe('meeting-agenda');
      expect(KNOWLEDGE_DOCUMENT_TYPES.MEETING_MINUTES).toBe('meeting-minutes');
      expect(KNOWLEDGE_DOCUMENT_TYPES.USE_CASE).toBe('use-case');
      expect(KNOWLEDGE_DOCUMENT_TYPES.BUSINESS_REQUIREMENTS).toBe(
        'business-requirements',
      );
      expect(KNOWLEDGE_DOCUMENT_TYPES.SALES_CALL_SUMMARY).toBe(
        'sales-call-summary',
      );
      expect(KNOWLEDGE_DOCUMENT_TYPES.SALES_STRATEGY).toBe('sales-strategy');
    });

    it('should have exactly 8 knowledge types', () => {
      expect(Object.keys(KNOWLEDGE_DOCUMENT_TYPES)).toHaveLength(8);
    });
  });

  describe('Zod Schemas', () => {
    describe('RawDocumentTypeSchema', () => {
      it('should validate all raw document types', () => {
        Object.values(RAW_DOCUMENT_TYPES).forEach((type) => {
          const result = RawDocumentTypeSchema.safeParse(type);
          expect(result.success).toBe(true);
        });
      });

      it('should reject invalid raw types', () => {
        const result = RawDocumentTypeSchema.safeParse('invalid-type');
        expect(result.success).toBe(false);
      });

      it('should reject knowledge types', () => {
        const result = RawDocumentTypeSchema.safeParse('meeting-analysis');
        expect(result.success).toBe(false);
      });
    });

    describe('KnowledgeDocumentTypeSchema', () => {
      it('should validate all knowledge document types', () => {
        Object.values(KNOWLEDGE_DOCUMENT_TYPES).forEach((type) => {
          const result = KnowledgeDocumentTypeSchema.safeParse(type);
          expect(result.success).toBe(true);
        });
      });

      it('should reject invalid knowledge types', () => {
        const result = KnowledgeDocumentTypeSchema.safeParse('invalid-type');
        expect(result.success).toBe(false);
      });

      it('should reject raw types', () => {
        const result = KnowledgeDocumentTypeSchema.safeParse('transcript');
        expect(result.success).toBe(false);
      });
    });

    describe('DocumentTypeSchema (union)', () => {
      it('should validate all raw types', () => {
        Object.values(RAW_DOCUMENT_TYPES).forEach((type) => {
          const result = DocumentTypeSchema.safeParse(type);
          expect(result.success).toBe(true);
        });
      });

      it('should validate all knowledge types', () => {
        Object.values(KNOWLEDGE_DOCUMENT_TYPES).forEach((type) => {
          const result = DocumentTypeSchema.safeParse(type);
          expect(result.success).toBe(true);
        });
      });

      it('should reject completely invalid types', () => {
        const result = DocumentTypeSchema.safeParse('not-a-valid-type');
        expect(result.success).toBe(false);
      });
    });
  });

  describe('Type Guards', () => {
    describe('isRawDocumentType', () => {
      it('should return true for all raw types', () => {
        Object.values(RAW_DOCUMENT_TYPES).forEach((type) => {
          expect(isRawDocumentType(type)).toBe(true);
        });
      });

      it('should return false for knowledge types', () => {
        Object.values(KNOWLEDGE_DOCUMENT_TYPES).forEach((type) => {
          expect(isRawDocumentType(type)).toBe(false);
        });
      });

      it('should return false for invalid strings', () => {
        expect(isRawDocumentType('invalid-type')).toBe(false);
        expect(isRawDocumentType('')).toBe(false);
        expect(isRawDocumentType('TRANSCRIPT')).toBe(false); // Uppercase
      });
    });

    describe('isKnowledgeDocumentType', () => {
      it('should return true for all knowledge types', () => {
        Object.values(KNOWLEDGE_DOCUMENT_TYPES).forEach((type) => {
          expect(isKnowledgeDocumentType(type)).toBe(true);
        });
      });

      it('should return false for raw types', () => {
        Object.values(RAW_DOCUMENT_TYPES).forEach((type) => {
          expect(isKnowledgeDocumentType(type)).toBe(false);
        });
      });

      it('should return false for invalid strings', () => {
        expect(isKnowledgeDocumentType('invalid-type')).toBe(false);
        expect(isKnowledgeDocumentType('')).toBe(false);
      });
    });

    describe('isValidDocumentType', () => {
      it('should return true for all raw types', () => {
        Object.values(RAW_DOCUMENT_TYPES).forEach((type) => {
          expect(isValidDocumentType(type)).toBe(true);
        });
      });

      it('should return true for all knowledge types', () => {
        Object.values(KNOWLEDGE_DOCUMENT_TYPES).forEach((type) => {
          expect(isValidDocumentType(type)).toBe(true);
        });
      });

      it('should return false for invalid types', () => {
        expect(isValidDocumentType('invalid-type')).toBe(false);
        expect(isValidDocumentType('')).toBe(false);
        expect(isValidDocumentType('meeting_analysis')).toBe(false); // Wrong format
      });
    });
  });

  describe('Display Labels', () => {
    describe('RAW_DOCUMENT_TYPE_LABELS', () => {
      it('should have labels for all raw types', () => {
        Object.values(RAW_DOCUMENT_TYPES).forEach((type) => {
          expect(RAW_DOCUMENT_TYPE_LABELS[type]).toBeDefined();
          expect(RAW_DOCUMENT_TYPE_LABELS[type].length).toBeGreaterThan(0);
        });
      });

      it('should have human-readable labels', () => {
        expect(RAW_DOCUMENT_TYPE_LABELS[RAW_DOCUMENT_TYPES.TRANSCRIPT]).toBe(
          'Transcript',
        );
        expect(RAW_DOCUMENT_TYPE_LABELS[RAW_DOCUMENT_TYPES.EMAIL]).toBe(
          'Email',
        );
        expect(RAW_DOCUMENT_TYPE_LABELS[RAW_DOCUMENT_TYPES.SLACK]).toBe(
          'Slack Conversation',
        );
        expect(RAW_DOCUMENT_TYPE_LABELS[RAW_DOCUMENT_TYPES.MEETING_NOTES]).toBe(
          'Meeting Notes',
        );
        expect(RAW_DOCUMENT_TYPE_LABELS[RAW_DOCUMENT_TYPES.RESEARCH]).toBe(
          'Research Document',
        );
        expect(RAW_DOCUMENT_TYPE_LABELS[RAW_DOCUMENT_TYPES.OTHER]).toBe(
          'Other',
        );
      });
    });

    describe('KNOWLEDGE_DOCUMENT_TYPE_LABELS', () => {
      it('should have labels for all knowledge types', () => {
        Object.values(KNOWLEDGE_DOCUMENT_TYPES).forEach((type) => {
          expect(KNOWLEDGE_DOCUMENT_TYPE_LABELS[type]).toBeDefined();
          expect(KNOWLEDGE_DOCUMENT_TYPE_LABELS[type].length).toBeGreaterThan(
            0,
          );
        });
      });

      it('should have human-readable labels', () => {
        expect(KNOWLEDGE_DOCUMENT_TYPE_LABELS.text).toBe('Text');
        expect(KNOWLEDGE_DOCUMENT_TYPE_LABELS['meeting-analysis']).toBe(
          'Meeting Analysis',
        );
        expect(KNOWLEDGE_DOCUMENT_TYPE_LABELS['sales-call-summary']).toBe(
          'Sales Call Summary',
        );
      });
    });

    describe('getDocumentTypeLabel', () => {
      it('should return correct labels for raw types', () => {
        Object.values(RAW_DOCUMENT_TYPES).forEach((type) => {
          const label = getDocumentTypeLabel(type);
          expect(label).toBe(RAW_DOCUMENT_TYPE_LABELS[type]);
          expect(label).not.toBe('Unknown');
        });
      });

      it('should return correct labels for knowledge types', () => {
        Object.values(KNOWLEDGE_DOCUMENT_TYPES).forEach((type) => {
          const label = getDocumentTypeLabel(type);
          expect(label).toBe(KNOWLEDGE_DOCUMENT_TYPE_LABELS[type]);
          expect(label).not.toBe('Unknown');
        });
      });

      it('should return "Unknown" for invalid types', () => {
        // @ts-expect-error - testing invalid input
        expect(getDocumentTypeLabel('invalid-type')).toBe('Unknown');
        // @ts-expect-error - testing invalid input
        expect(getDocumentTypeLabel('')).toBe('Unknown');
      });
    });
  });

  describe('Type System Integrity', () => {
    it('should have no overlap between raw and knowledge types', () => {
      const rawValues = Object.values(RAW_DOCUMENT_TYPES);
      const knowledgeValues = Object.values(KNOWLEDGE_DOCUMENT_TYPES);

      rawValues.forEach((rawType) => {
        expect(knowledgeValues).not.toContain(rawType);
      });
    });

    it('should have consistent naming conventions', () => {
      // Raw types use underscore for compound words
      expect(RAW_DOCUMENT_TYPES.MEETING_NOTES).toMatch(/_/);

      // Knowledge types use hyphens for compound words
      expect(KNOWLEDGE_DOCUMENT_TYPES.MEETING_ANALYSIS).toMatch(/-/);
      expect(KNOWLEDGE_DOCUMENT_TYPES.SALES_CALL_SUMMARY).toMatch(/-/);
    });

    it('should have all labels properly capitalized', () => {
      Object.values(RAW_DOCUMENT_TYPE_LABELS).forEach((label) => {
        // First letter should be uppercase
        expect(label[0]).toBe(label[0].toUpperCase());
      });

      Object.values(KNOWLEDGE_DOCUMENT_TYPE_LABELS).forEach((label) => {
        // First letter should be uppercase
        expect(label[0]).toBe(label[0].toUpperCase());
      });
    });
  });
});
