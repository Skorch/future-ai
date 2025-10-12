import { describe, it, expect } from 'vitest';
import {
  DOCUMENT_SUMMARY_PROMPTS,
  getSummaryPromptForType,
  formatSummaryPrompt,
  buildSummaryPromptWithContent,
} from '@/lib/prompts/document-summary-prompts';
import { RAW_DOCUMENT_TYPES } from '@/lib/db/types/document-types';

describe('document-summary-prompts', () => {
  describe('DOCUMENT_SUMMARY_PROMPTS', () => {
    it('should have prompts for all raw document types', () => {
      const rawTypes = Object.values(RAW_DOCUMENT_TYPES);

      rawTypes.forEach((type) => {
        expect(DOCUMENT_SUMMARY_PROMPTS[type]).toBeDefined();
        expect(DOCUMENT_SUMMARY_PROMPTS[type].instruction).toBeTruthy();
        expect(DOCUMENT_SUMMARY_PROMPTS[type].focusAreas).toBeInstanceOf(Array);
        expect(
          DOCUMENT_SUMMARY_PROMPTS[type].focusAreas.length,
        ).toBeGreaterThan(0);
      });
    });

    it('should have non-empty instructions for each type', () => {
      Object.values(DOCUMENT_SUMMARY_PROMPTS).forEach((prompt) => {
        expect(prompt.instruction.length).toBeGreaterThan(0);
        expect(prompt.instruction).toMatch(/\w+/); // Contains actual words
      });
    });

    it('should have meaningful focus areas for each type', () => {
      Object.values(DOCUMENT_SUMMARY_PROMPTS).forEach((prompt) => {
        prompt.focusAreas.forEach((area) => {
          expect(area.length).toBeGreaterThan(0);
          expect(area).toMatch(/\w+/); // Contains actual words
        });
      });
    });
  });

  describe('getSummaryPromptForType', () => {
    it('should return correct prompt for transcript', () => {
      const prompt = getSummaryPromptForType(RAW_DOCUMENT_TYPES.TRANSCRIPT);

      expect(prompt.instruction).toContain('transcript');
      expect(prompt.focusAreas.some((area) => /action items/i.test(area))).toBe(
        true,
      );
    });

    it('should return correct prompt for email', () => {
      const prompt = getSummaryPromptForType(RAW_DOCUMENT_TYPES.EMAIL);

      expect(prompt.instruction).toContain('email');
      expect(prompt.focusAreas.length).toBeGreaterThan(3);
    });

    it('should return correct prompt for slack', () => {
      const prompt = getSummaryPromptForType(RAW_DOCUMENT_TYPES.SLACK);

      expect(prompt.instruction).toContain('Slack');
      expect(prompt.focusAreas).toBeDefined();
    });

    it('should return correct prompt for meeting_notes', () => {
      const prompt = getSummaryPromptForType(RAW_DOCUMENT_TYPES.MEETING_NOTES);

      expect(prompt.instruction).toContain('meeting notes');
    });

    it('should return correct prompt for research', () => {
      const prompt = getSummaryPromptForType(RAW_DOCUMENT_TYPES.RESEARCH);

      expect(prompt.instruction).toContain('research');
      expect(prompt.focusAreas.some((area) => /findings/i.test(area))).toBe(
        true,
      );
    });

    it('should return generic prompt for other', () => {
      const prompt = getSummaryPromptForType(RAW_DOCUMENT_TYPES.OTHER);

      expect(prompt.instruction).toBeTruthy();
      expect(prompt.focusAreas).toBeDefined();
    });
  });

  describe('formatSummaryPrompt', () => {
    it('should format prompt with instruction and focus areas', () => {
      const formatted = formatSummaryPrompt(RAW_DOCUMENT_TYPES.TRANSCRIPT);

      expect(formatted).toContain(
        DOCUMENT_SUMMARY_PROMPTS[RAW_DOCUMENT_TYPES.TRANSCRIPT].instruction,
      );
      expect(formatted).toContain('Focus on:');
      expect(formatted).toContain('-'); // Bullet points
    });

    it('should include all focus areas as bullet points', () => {
      const type = RAW_DOCUMENT_TYPES.EMAIL;
      const formatted = formatSummaryPrompt(type);
      const prompt = DOCUMENT_SUMMARY_PROMPTS[type];

      prompt.focusAreas.forEach((area) => {
        expect(formatted).toContain(`- ${area}`);
      });
    });

    it('should maintain formatting consistency across all types', () => {
      Object.values(RAW_DOCUMENT_TYPES).forEach((type) => {
        const formatted = formatSummaryPrompt(type);

        expect(formatted).toMatch(/Focus on:/);
        expect(formatted.split('\n-').length).toBeGreaterThan(1); // Has bullet points
      });
    });
  });

  describe('buildSummaryPromptWithContent', () => {
    it('should include formatted prompt and content', () => {
      const content = 'This is the document content to summarize';
      const built = buildSummaryPromptWithContent(
        RAW_DOCUMENT_TYPES.TRANSCRIPT,
        content,
      );

      expect(built).toContain(
        DOCUMENT_SUMMARY_PROMPTS[RAW_DOCUMENT_TYPES.TRANSCRIPT].instruction,
      );
      expect(built).toContain('Focus on:');
      expect(built).toContain('**Document Content:**');
      expect(built).toContain(content);
    });

    it('should include title when provided', () => {
      const content = 'Document content';
      const title = 'Q4 Sales Meeting';
      const built = buildSummaryPromptWithContent(
        RAW_DOCUMENT_TYPES.TRANSCRIPT,
        content,
        title,
      );

      expect(built).toContain('**Document Title:**');
      expect(built).toContain(title);
    });

    it('should omit title section when not provided', () => {
      const content = 'Document content';
      const built = buildSummaryPromptWithContent(
        RAW_DOCUMENT_TYPES.TRANSCRIPT,
        content,
      );

      expect(built).not.toContain('**Document Title:**');
    });

    it('should handle long content without truncation', () => {
      const longContent = 'A'.repeat(10000);
      const built = buildSummaryPromptWithContent(
        RAW_DOCUMENT_TYPES.RESEARCH,
        longContent,
      );

      expect(built).toContain(longContent);
      expect(built.length).toBeGreaterThan(longContent.length); // Includes prompt too
    });

    it('should work for all document types', () => {
      const content = 'Sample content for testing';

      Object.values(RAW_DOCUMENT_TYPES).forEach((type) => {
        const built = buildSummaryPromptWithContent(type, content);

        expect(built).toContain(content);
        expect(built).toContain('Focus on:');
        expect(built.length).toBeGreaterThan(content.length);
      });
    });
  });

  describe('Prompt quality validation', () => {
    it('transcript prompt should mention action items and decisions', () => {
      const prompt = DOCUMENT_SUMMARY_PROMPTS[RAW_DOCUMENT_TYPES.TRANSCRIPT];
      const allText = prompt.instruction + prompt.focusAreas.join(' ');

      expect(allText.toLowerCase()).toMatch(/action items/);
      expect(allText.toLowerCase()).toMatch(/decisions/);
    });

    it('email prompt should mention requests and responses', () => {
      const prompt = DOCUMENT_SUMMARY_PROMPTS[RAW_DOCUMENT_TYPES.EMAIL];
      const allText = prompt.instruction + prompt.focusAreas.join(' ');

      expect(allText.toLowerCase()).toMatch(/request/);
    });

    it('research prompt should mention findings and methodology', () => {
      const prompt = DOCUMENT_SUMMARY_PROMPTS[RAW_DOCUMENT_TYPES.RESEARCH];
      const allText = prompt.instruction + prompt.focusAreas.join(' ');

      expect(allText.toLowerCase()).toMatch(/findings/);
      expect(allText.toLowerCase()).toMatch(/methodolog/);
    });

    it('meeting_notes prompt should be distinct from transcript prompt', () => {
      const notesPrompt =
        DOCUMENT_SUMMARY_PROMPTS[RAW_DOCUMENT_TYPES.MEETING_NOTES];
      const transcriptPrompt =
        DOCUMENT_SUMMARY_PROMPTS[RAW_DOCUMENT_TYPES.TRANSCRIPT];

      // Different instructions
      expect(notesPrompt.instruction).not.toBe(transcriptPrompt.instruction);

      // Meeting notes should mention 'notes' specifically
      expect(notesPrompt.instruction.toLowerCase()).toContain('notes');
    });
  });
});
