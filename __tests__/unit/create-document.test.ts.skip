import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createDocument } from '@/lib/ai/tools/create-document';
import {
  validateSummaryStructure,
  embedMetadataInContent,
} from '@/lib/ai/utils/summary-parser';
import type { UIMessageStreamWriter } from 'ai';

// Mock dependencies
vi.mock('@/lib/db/queries', () => ({
  saveDocument: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/ai/utils/summary-parser', () => ({
  validateSummaryStructure: vi.fn(),
  embedMetadataInContent: vi.fn(),
}));

vi.mock('@/lib/artifacts/server', () => ({
  artifactKinds: ['text', 'code', 'sheet'] as const,
  documentHandlersByArtifactKind: [
    {
      kind: 'text',
      onCreateDocument: vi.fn().mockResolvedValue(undefined),
    },
    {
      kind: 'code',
      onCreateDocument: vi.fn().mockResolvedValue(undefined),
    },
    {
      kind: 'sheet',
      onCreateDocument: vi.fn().mockResolvedValue(undefined),
    },
  ],
}));

describe('Create Document Tool', () => {
  const mockSession = {
    user: { id: 'user123', email: 'test@example.com' },
  } as any;

  const mockDataStream: UIMessageStreamWriter<any> = {
    write: vi.fn(),
    append: vi.fn(),
    appendMessageAnnotation: vi.fn(),
    writeData: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Meeting Summary Creation', () => {
    it('should create a meeting summary document', async () => {
      const summaryContent = `# Meeting Summary: Test Meeting
**Date:** 2024-01-15
**Participants:** Alice, Bob

## Topic: First Topic
Content here

## Topic: Second Topic
More content`;

      vi.mocked(validateSummaryStructure).mockReturnValue({
        isValid: true,
        topics: ['First Topic', 'Second Topic'],
        errors: [],
      });

      vi.mocked(embedMetadataInContent).mockReturnValue(
        `<!-- metadata: {...} -->\n${summaryContent}`,
      );

      const tool = createDocument({
        session: mockSession,
        dataStream: mockDataStream,
      });

      const result = await tool.execute({
        title: 'Test Meeting Summary',
        content: summaryContent,
        kind: 'text',
        documentType: 'meeting-summary',
        metadata: {
          isTranscriptSummary: true,
          meetingDate: '2024-01-15',
          participants: ['Alice', 'Bob'],
        },
      });

      expect(result.documentType).toBe('meeting-summary');
      expect(result.topicsFound).toEqual(['First Topic', 'Second Topic']);
      expect(result.kind).toBe('text');
      expect(result.content).toBe(
        'Meeting summary created with extracted topics.',
      );

      // Verify validation was called
      expect(validateSummaryStructure).toHaveBeenCalledWith(summaryContent);

      // Verify metadata embedding was called
      expect(embedMetadataInContent).toHaveBeenCalledWith(
        summaryContent,
        'meeting-summary',
        expect.objectContaining({
          isTranscriptSummary: true,
          meetingDate: '2024-01-15',
          participants: ['Alice', 'Bob'],
        }),
        ['First Topic', 'Second Topic'],
      );

      // Verify data stream writes
      expect(mockDataStream.write).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'data-kind',
          data: 'text',
        }),
      );

      expect(mockDataStream.write).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'data-textDelta',
        }),
      );
    });

    it('should add warnings for invalid summary structure', async () => {
      vi.mocked(validateSummaryStructure).mockReturnValue({
        isValid: false,
        topics: [],
        errors: ['No topic sections found', 'Missing date'],
      });

      vi.mocked(embedMetadataInContent).mockImplementation(
        (content) => `<!-- metadata -->\n${content}`,
      );

      const tool = createDocument({
        session: mockSession,
        dataStream: mockDataStream,
      });

      await tool.execute({
        title: 'Invalid Summary',
        content: '## Some content without proper structure',
        kind: 'text',
        documentType: 'meeting-summary',
      });

      // Check that warnings were added
      const textDeltaCall = mockDataStream.write.mock.calls.find(
        (call) => call[0].type === 'data-textDelta',
      );

      expect(textDeltaCall[0].data).toContain(
        '<!-- Warning: No topic sections found -->',
      );
      expect(textDeltaCall[0].data).toContain('<!-- Warning: Missing date -->');
    });

    it('should store meeting summaries as text kind', async () => {
      const { saveDocument } = await import('@/lib/db/queries');

      vi.mocked(validateSummaryStructure).mockReturnValue({
        isValid: true,
        topics: ['Topic'],
        errors: [],
      });

      vi.mocked(embedMetadataInContent).mockReturnValue('final content');

      const tool = createDocument({
        session: mockSession,
        dataStream: mockDataStream,
      });

      await tool.execute({
        title: 'Meeting',
        content: 'content',
        kind: 'text',
        documentType: 'meeting-summary',
      });

      expect(saveDocument).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: 'text', // Should always be text for meeting summaries
          content: 'final content',
        }),
      );
    });
  });

  describe('General Document Handling', () => {
    it('should handle general documents without validation', async () => {
      const tool = createDocument({
        session: mockSession,
        dataStream: mockDataStream,
      });

      const result = await tool.execute({
        title: 'General Document',
        kind: 'text',
        documentType: 'general',
      });

      expect(result.documentType).toBe('general');
      expect(result.topicsFound).toEqual([]);
      expect(validateSummaryStructure).not.toHaveBeenCalled();
      expect(embedMetadataInContent).not.toHaveBeenCalled();
    });

    it('should use document handlers for dynamic generation', async () => {
      const { documentHandlersByArtifactKind } = await import(
        '@/lib/artifacts/server'
      );

      const tool = createDocument({
        session: mockSession,
        dataStream: mockDataStream,
      });

      await tool.execute({
        title: 'Code Document',
        kind: 'code',
      });

      const codeHandler = documentHandlersByArtifactKind.find(
        (h) => h.kind === 'code',
      );
      expect(codeHandler?.onCreateDocument).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Code Document',
          session: mockSession,
          dataStream: mockDataStream,
        }),
      );
    });

    it('should default to general document type', async () => {
      const tool = createDocument({
        session: mockSession,
        dataStream: mockDataStream,
      });

      const result = await tool.execute({
        title: 'Some Document',
        kind: 'text',
      });

      expect(result.documentType).toBe('general');
    });
  });

  describe('Error Handling', () => {
    it('should throw error for unsupported kind without content', async () => {
      const tool = createDocument({
        session: mockSession,
        dataStream: mockDataStream,
      });

      await expect(
        tool.execute({
          title: 'Invalid',
          kind: 'invalid' as any,
        }),
      ).rejects.toThrow('No document handler found for kind: invalid');
    });

    it('should handle missing session gracefully', async () => {
      const tool = createDocument({
        session: null as any,
        dataStream: mockDataStream,
      });

      vi.mocked(validateSummaryStructure).mockReturnValue({
        isValid: true,
        topics: [],
        errors: [],
      });

      vi.mocked(embedMetadataInContent).mockReturnValue('content');

      const result = await tool.execute({
        title: 'No Session',
        content: 'test',
        kind: 'text',
        documentType: 'meeting-summary',
      });

      // Should complete without throwing
      expect(result).toBeDefined();

      // But should not save to database
      const { saveDocument } = await import('@/lib/db/queries');
      expect(saveDocument).not.toHaveBeenCalled();
    });
  });

  describe('Data Stream Operations', () => {
    it('should write correct sequence of stream events', async () => {
      vi.mocked(validateSummaryStructure).mockReturnValue({
        isValid: true,
        topics: [],
        errors: [],
      });

      vi.mocked(embedMetadataInContent).mockReturnValue('final');

      const tool = createDocument({
        session: mockSession,
        dataStream: mockDataStream,
      });

      await tool.execute({
        title: 'Stream Test',
        content: 'content',
        kind: 'text',
        documentType: 'meeting-summary',
      });

      const writeCallTypes = mockDataStream.write.mock.calls.map(
        (call) => call[0].type,
      );

      expect(writeCallTypes).toEqual([
        'data-kind',
        'data-id',
        'data-title',
        'data-clear',
        'data-textDelta',
        'data-finish',
      ]);
    });

    it('should mark all stream writes as transient', async () => {
      const tool = createDocument({
        session: mockSession,
        dataStream: mockDataStream,
      });

      await tool.execute({
        title: 'Transient Test',
        kind: 'text',
      });

      mockDataStream.write.mock.calls.forEach((call) => {
        expect(call[0].transient).toBe(true);
      });
    });
  });

  describe('Return Values', () => {
    it('should return appropriate message for meeting summaries', async () => {
      vi.mocked(validateSummaryStructure).mockReturnValue({
        isValid: true,
        topics: ['A', 'B'],
        errors: [],
      });

      vi.mocked(embedMetadataInContent).mockReturnValue('x');

      const tool = createDocument({
        session: mockSession,
        dataStream: mockDataStream,
      });

      const result = await tool.execute({
        title: 'Meeting',
        content: 'x',
        kind: 'text',
        documentType: 'meeting-summary',
      });

      expect(result.content).toBe(
        'Meeting summary created with extracted topics.',
      );
    });

    it('should return appropriate message for general documents', async () => {
      const tool = createDocument({
        session: mockSession,
        dataStream: mockDataStream,
      });

      const result = await tool.execute({
        title: 'General',
        kind: 'text',
      });

      expect(result.content).toBe(
        'A document was created and is now visible to the user.',
      );
    });

    it('should always include id, title, and kind in result', async () => {
      const tool = createDocument({
        session: mockSession,
        dataStream: mockDataStream,
      });

      const result = await tool.execute({
        title: 'Test Title',
        kind: 'sheet',
      });

      expect(result.id).toBeDefined();
      expect(result.id).toMatch(/^[a-z0-9-]+$/); // UUID pattern
      expect(result.title).toBe('Test Title');
      expect(result.kind).toBe('sheet');
    });
  });
});
