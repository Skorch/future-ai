import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateDocumentMetadata } from '@/lib/ai/generate-document-metadata';
import { RAW_DOCUMENT_TYPES } from '@/lib/db/types/document-types';

// Mock AI SDK
vi.mock('ai', () => ({
  generateObject: vi.fn(),
}));

describe('generateDocumentMetadata', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return valid metadata structure for transcript', async () => {
    const { generateObject } = await import('ai');
    vi.mocked(generateObject).mockResolvedValue({
      object: {
        title: 'Q4 Sales Review Meeting',
        documentType: RAW_DOCUMENT_TYPES.TRANSCRIPT,
        summary: 'Discussion of Q4 sales performance and targets',
      },
      // @ts-expect-error - partial mock
      finishReason: 'stop',
      usage: {},
    });

    const result = await generateDocumentMetadata({
      content: 'This is a sales meeting transcript with speaker labels...',
    });

    expect(result).toMatchObject({
      title: expect.any(String),
      documentType: RAW_DOCUMENT_TYPES.TRANSCRIPT,
      summary: expect.any(String),
    });
    expect(result.title.length).toBeLessThanOrEqual(80);
  });

  it('should handle email content classification', async () => {
    const { generateObject } = await import('ai');
    vi.mocked(generateObject).mockResolvedValue({
      object: {
        title: 'Project Proposal Review',
        documentType: RAW_DOCUMENT_TYPES.EMAIL,
      },
      // @ts-expect-error - partial mock
      finishReason: 'stop',
      usage: {},
    });

    const result = await generateDocumentMetadata({
      content:
        'From: john@example.com\nTo: team@example.com\nSubject: Proposal',
    });

    expect(result.documentType).toBe(RAW_DOCUMENT_TYPES.EMAIL);
  });

  it('should handle slack conversation classification', async () => {
    const { generateObject } = await import('ai');
    vi.mocked(generateObject).mockResolvedValue({
      object: {
        title: 'Engineering Team Discussion',
        documentType: RAW_DOCUMENT_TYPES.SLACK,
      },
      // @ts-expect-error - partial mock
      finishReason: 'stop',
      usage: {},
    });

    const result = await generateDocumentMetadata({
      content: '@john: Hey team, can we discuss the API changes?\n@jane: Sure!',
    });

    expect(result.documentType).toBe(RAW_DOCUMENT_TYPES.SLACK);
  });

  it('should enforce max title length', async () => {
    const { generateObject } = await import('ai');
    vi.mocked(generateObject).mockResolvedValue({
      object: {
        title: 'Short Title',
        documentType: RAW_DOCUMENT_TYPES.OTHER,
      },
      // @ts-expect-error - partial mock
      finishReason: 'stop',
      usage: {},
    });

    const customMaxLength = 50;
    await generateDocumentMetadata({
      content: 'Some content',
      maxTitleLength: customMaxLength,
    });

    const { generateObject: genObj } = await import('ai');
    const callArgs = vi.mocked(genObj).mock.calls[0][0];

    // Verify system prompt mentions the custom max length
    expect(callArgs.system).toContain(`max ${customMaxLength}`);
  });

  it('should include fileName in prompt when provided', async () => {
    const { generateObject } = await import('ai');
    vi.mocked(generateObject).mockResolvedValue({
      object: {
        title: 'Meeting Notes',
        documentType: RAW_DOCUMENT_TYPES.MEETING_NOTES,
      },
      // @ts-expect-error - partial mock
      finishReason: 'stop',
      usage: {},
    });

    const fileName = 'q4-planning-meeting.txt';
    await generateDocumentMetadata({
      content: 'Meeting notes content',
      fileName,
    });

    const { generateObject: genObj } = await import('ai');
    const callArgs = vi.mocked(genObj).mock.calls[0][0];

    // Verify fileName is included in prompt
    expect(callArgs.prompt).toContain(fileName);
  });

  it('should handle research document classification', async () => {
    const { generateObject } = await import('ai');
    vi.mocked(generateObject).mockResolvedValue({
      object: {
        title: 'AI Market Analysis Report',
        documentType: RAW_DOCUMENT_TYPES.RESEARCH,
        summary: 'Comprehensive analysis of AI market trends',
      },
      // @ts-expect-error - partial mock
      finishReason: 'stop',
      usage: {},
    });

    const result = await generateDocumentMetadata({
      content:
        'Executive Summary\n\nThis report analyzes current trends in the AI market...',
    });

    expect(result.documentType).toBe(RAW_DOCUMENT_TYPES.RESEARCH);
  });

  it('should default to "other" for ambiguous content', async () => {
    const { generateObject } = await import('ai');
    vi.mocked(generateObject).mockResolvedValue({
      object: {
        title: 'Miscellaneous Notes',
        documentType: RAW_DOCUMENT_TYPES.OTHER,
      },
      // @ts-expect-error - partial mock
      finishReason: 'stop',
      usage: {},
    });

    const result = await generateDocumentMetadata({
      content: 'Random notes and thoughts...',
    });

    expect(result.documentType).toBe(RAW_DOCUMENT_TYPES.OTHER);
  });

  it('should use correct model configuration', async () => {
    const { generateObject } = await import('ai');
    vi.mocked(generateObject).mockResolvedValue({
      object: {
        title: 'Test Document',
        documentType: RAW_DOCUMENT_TYPES.OTHER,
      },
      // @ts-expect-error - partial mock
      finishReason: 'stop',
      usage: {},
    });

    await generateDocumentMetadata({
      content: 'Test content',
    });

    const { generateObject: genObj } = await import('ai');
    const callArgs = vi.mocked(genObj).mock.calls[0][0];

    // Verify correct settings
    expect(callArgs.mode).toBe('json');
    expect(callArgs.temperature).toBe(0.3);
    expect(callArgs.schema).toBeDefined();
  });

  it('should handle optional summary field', async () => {
    const { generateObject } = await import('ai');

    // Test with summary
    vi.mocked(generateObject).mockResolvedValueOnce({
      object: {
        title: 'Document With Summary',
        documentType: RAW_DOCUMENT_TYPES.TRANSCRIPT,
        summary: 'This is a summary',
      },
      // @ts-expect-error - partial mock
      finishReason: 'stop',
      usage: {},
    });

    const withSummary = await generateDocumentMetadata({
      content: 'Long content that warrants a summary...',
    });
    expect(withSummary.summary).toBeDefined();

    // Test without summary
    vi.mocked(generateObject).mockResolvedValueOnce({
      object: {
        title: 'Document Without Summary',
        documentType: RAW_DOCUMENT_TYPES.OTHER,
      },
      // @ts-expect-error - partial mock
      finishReason: 'stop',
      usage: {},
    });

    const withoutSummary = await generateDocumentMetadata({
      content: 'Short content',
    });
    expect(withoutSummary.summary).toBeUndefined();
  });

  it('should send full content to AI without truncation', async () => {
    const { generateObject } = await import('ai');
    vi.mocked(generateObject).mockResolvedValue({
      object: {
        title: 'Long Document',
        documentType: RAW_DOCUMENT_TYPES.TRANSCRIPT,
      },
      // @ts-expect-error - partial mock
      finishReason: 'stop',
      usage: {},
    });

    const longContent = 'A'.repeat(10000); // 10k characters
    await generateDocumentMetadata({
      content: longContent,
    });

    const { generateObject: genObj } = await import('ai');
    const callArgs = vi.mocked(genObj).mock.calls[0][0];

    // Verify full content is sent (no truncation)
    expect(callArgs.prompt).toContain(longContent);
  });
});
