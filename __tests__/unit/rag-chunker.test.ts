import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateObject } from 'ai';
import { chunkTranscriptItems } from '../../lib/ai/utils/rag-chunker';
import type { TranscriptItem } from '../../lib/rag/types';

// Mock the AI SDK
vi.mock('ai', () => ({
  generateObject: vi.fn(),
}));

// Mock the provider
vi.mock('../../lib/ai/providers', () => ({
  myProvider: {
    languageModel: vi.fn(() => 'mocked-model'),
  },
}));

describe('RAG Chunker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createMockTranscript = (length: number): TranscriptItem[] => {
    return Array.from({ length }, (_, i) => ({
      timecode: i * 10,
      speaker: i % 2 === 0 ? 'Alice' : 'Bob',
      text: `Statement ${i + 1}`,
    }));
  };

  describe('chunkTranscriptItems', () => {
    it('should handle empty transcript', async () => {
      const result = await chunkTranscriptItems([], ['Topic1', 'Topic2']);
      expect(result).toEqual([]);
    });

    it('should process small conversations in dry-run mode', async () => {
      const items = createMockTranscript(10);
      const topics = ['Planning', 'Budget', 'Technical'];

      const chunks = await chunkTranscriptItems(items, topics, {
        dryRun: true,
        chunkSize: 200,
      });

      // Verify chunks exist
      expect(chunks.length).toBeGreaterThan(0);

      // Verify contiguity
      expect(chunks[0].startIdx).toBe(0);
      expect(chunks[chunks.length - 1].endIdx).toBe(items.length - 1);

      // Verify no gaps
      for (let i = 1; i < chunks.length; i++) {
        expect(chunks[i].startIdx).toBe(chunks[i - 1].endIdx + 1);
      }

      // Verify metadata
      chunks.forEach((chunk) => {
        expect(chunk.metadata.speakers).toBeDefined();
        expect(chunk.metadata.startTime).toBeDefined();
        expect(chunk.metadata.endTime).toBeDefined();
        expect(chunk.topic).toMatch(/Planning|Budget|Technical/);
      });
    });

    it('should handle natural boundaries in fallback mode', async () => {
      // Create transcript with speaker change
      const items: TranscriptItem[] = [
        { timecode: 0, speaker: 'Alice', text: 'First topic discussion' },
        { timecode: 10, speaker: 'Alice', text: 'Continuing first topic' },
        { timecode: 20, speaker: 'Alice', text: 'More about first topic' },
        { timecode: 30, speaker: 'Bob', text: 'Switching to second topic' },
        { timecode: 40, speaker: 'Bob', text: 'Details about second topic' },
        { timecode: 50, speaker: 'Charlie', text: 'Third topic introduction' },
      ];

      const chunks = await chunkTranscriptItems(
        items,
        ['Topic1', 'Topic2', 'Topic3'],
        { dryRun: true },
      );

      // Should create chunks at natural boundaries
      expect(chunks.length).toBeGreaterThanOrEqual(2);

      // Verify all items are covered
      const totalItemsCovered = chunks.reduce(
        (sum, chunk) => sum + (chunk.endIdx - chunk.startIdx + 1),
        0,
      );
      expect(totalItemsCovered).toBe(items.length);
    });

    it('should handle AI-powered chunking with topic repetition', async () => {
      const items = createMockTranscript(6);
      const topics = ['Budget', 'Product'];

      // Mock AI response with topic repetition (A→B→A pattern)
      vi.mocked(generateObject).mockResolvedValueOnce({
        object: {
          chunks: [
            { topic: 'Budget', startIdx: 0, endIdx: 1 },
            { topic: 'Product', startIdx: 2, endIdx: 3 },
            { topic: 'Budget', startIdx: 4, endIdx: 5 },
          ],
        },
      } as any);

      const chunks = await chunkTranscriptItems(items, topics, {
        dryRun: false,
        model: 'test-model',
      });

      expect(chunks).toHaveLength(3);
      expect(chunks[0].topic).toBe('Budget');
      expect(chunks[1].topic).toBe('Product');
      expect(chunks[2].topic).toBe('Budget');

      // Verify generateObject was called with correct prompt structure
      expect(generateObject).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'mocked-model',
          schema: expect.any(Object),
          prompt: expect.stringContaining('AVAILABLE TOPICS'),
        }),
      );
    });

    it('should enforce contiguity when AI returns invalid chunks', async () => {
      const items = createMockTranscript(5);
      const topics = ['Topic1'];

      // Mock AI response with gaps (invalid)
      vi.mocked(generateObject).mockResolvedValueOnce({
        object: {
          chunks: [
            { topic: 'Topic1', startIdx: 0, endIdx: 1 },
            { topic: 'Topic1', startIdx: 3, endIdx: 4 }, // Gap!
          ],
        },
      } as any);

      const chunks = await chunkTranscriptItems(items, topics, {
        dryRun: false,
      });

      // Should fix the gaps
      expect(chunks[0].startIdx).toBe(0);
      expect(chunks[1].startIdx).toBe(chunks[0].endIdx + 1);
      expect(chunks[chunks.length - 1].endIdx).toBe(items.length - 1);
    });

    it('should fall back to General Discussion on AI error', async () => {
      const items = createMockTranscript(5);
      const topics = ['Topic1'];

      // Mock AI failure
      vi.mocked(generateObject).mockRejectedValueOnce(
        new Error('AI service unavailable'),
      );

      const chunks = await chunkTranscriptItems(items, topics, {
        dryRun: false,
      });

      // Should fall back gracefully
      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0].startIdx).toBe(0);
      expect(chunks[chunks.length - 1].endIdx).toBe(items.length - 1);
    });

    it('should handle large conversations without windowing', async () => {
      const items = createMockTranscript(250);
      const topics = ['Topic1', 'Topic2'];

      // Mock single AI response for entire conversation
      vi.mocked(generateObject).mockResolvedValueOnce({
        object: {
          chunks: [
            { topic: 'Topic1', startIdx: 0, endIdx: 99 },
            { topic: 'Topic2', startIdx: 100, endIdx: 199 },
            { topic: 'Topic1', startIdx: 200, endIdx: 249 }, // Topic repetition
          ],
        },
      } as any);

      const chunks = await chunkTranscriptItems(items, topics, {
        dryRun: false,
      });

      // Should call AI only once with entire conversation
      expect(generateObject).toHaveBeenCalledTimes(1);

      // Verify complete coverage
      expect(chunks[0].startIdx).toBe(0);
      expect(chunks[chunks.length - 1].endIdx).toBe(items.length - 1);

      // Should have 3 chunks with topic repetition
      expect(chunks).toHaveLength(3);
      expect(chunks[0].topic).toBe('Topic1');
      expect(chunks[1].topic).toBe('Topic2');
      expect(chunks[2].topic).toBe('Topic1');
    });

    it('should create proper content format', async () => {
      const items: TranscriptItem[] = [
        { timecode: 5.5, speaker: 'Alice', text: 'Hello world' },
        { timecode: 10.2, speaker: 'Bob', text: 'Hi there' },
      ];

      const chunks = await chunkTranscriptItems(items, ['General'], {
        dryRun: true,
      });

      expect(chunks[0].content).toContain('[5.5s] Alice: Hello world');
      expect(chunks[0].content).toContain('[10.2s] Bob: Hi there');
    });

    it('should extract unique speakers in metadata', async () => {
      const items: TranscriptItem[] = [
        { timecode: 0, speaker: 'Alice', text: 'First' },
        { timecode: 10, speaker: 'Bob', text: 'Second' },
        { timecode: 20, speaker: 'Alice', text: 'Third' },
        { timecode: 30, speaker: 'Charlie', text: 'Fourth' },
      ];

      const chunks = await chunkTranscriptItems(items, ['General'], {
        dryRun: true,
      });

      const allSpeakers = chunks.flatMap((c) => c.metadata.speakers);
      expect(allSpeakers).toContain('Alice');
      expect(allSpeakers).toContain('Bob');
      expect(allSpeakers).toContain('Charlie');
    });
  });

  describe('Prompt Generation', () => {
    it('should include all topics in prompt', async () => {
      const items = createMockTranscript(5);
      const topics = ['Budget', 'Planning', 'Technical', 'Operations'];

      vi.mocked(generateObject).mockResolvedValueOnce({
        object: {
          chunks: [{ topic: 'Budget', startIdx: 0, endIdx: 4 }],
        },
      } as any);

      await chunkTranscriptItems(items, topics, { dryRun: false });

      // Verify prompt includes all topics
      const promptArg = vi.mocked(generateObject).mock.calls[0][0].prompt;
      topics.forEach((topic) => {
        expect(promptArg).toContain(topic);
      });
      expect(promptArg).toContain('General Discussion');
    });

    it('should include critical rules in prompt', async () => {
      const items = createMockTranscript(3);

      vi.mocked(generateObject).mockResolvedValueOnce({
        object: {
          chunks: [{ topic: 'General', startIdx: 0, endIdx: 2 }],
        },
      } as any);

      await chunkTranscriptItems(items, ['Topic1'], { dryRun: false });

      const promptArg = vi.mocked(generateObject).mock.calls[0][0].prompt;

      // Verify critical rules are in prompt
      expect(promptArg).toContain('CONTIGUOUS');
      expect(promptArg).toContain('NO GAPS');
      expect(promptArg).toContain('First chunk must start at 0');
      expect(promptArg).toContain(`Last chunk must end at ${items.length - 1}`);
    });
  });
});
