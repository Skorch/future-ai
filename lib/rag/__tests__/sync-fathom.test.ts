import { describe, it, expect, vi, beforeEach } from 'vitest';
import { syncDocumentToRAG } from '../sync';
import { getDocumentById } from '@/lib/db/queries';
import { PineconeClient } from '../pinecone-client';
import { chunkTranscriptItems } from '@/lib/ai/utils/rag-chunker';
import { parseTranscript } from '@/lib/ai/utils/transcript-parser';

// Mock dependencies
vi.mock('@/lib/db/queries');
vi.mock('../pinecone-client');
vi.mock('@/lib/ai/utils/rag-chunker');

describe('Fathom Transcript RAG Sync', () => {
  let mockPineconeClient: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockPineconeClient = {
      writeDocuments: vi.fn().mockResolvedValue({ success: true }),
      deleteByMetadata: vi.fn().mockResolvedValue({ success: true }),
    };

    vi.mocked(PineconeClient).mockImplementation(
      () => mockPineconeClient as any,
    );
  });

  it('should successfully parse and chunk a Fathom transcript', async () => {
    // Sample Fathom transcript content (simplified from real format)
    const fathomContent = `00:00:00 Neil: Welcome everyone to today's meeting
00:00:15 Andrew: Thanks for having me
00:01:30 Neil: Let's discuss the quarterly results
00:02:45 Andrew: The numbers look promising
00:05:00 Neil: Now about the product roadmap
00:06:30 Andrew: We have three main initiatives`;

    const mockDocument = {
      id: 'doc-123',
      title: 'Neil and Andrew Beaupre - September 11.txt',
      content: fathomContent,
      userId: 'user-456',
      metadata: {
        documentType: 'transcript',
        fileName: 'Neil and Andrew Beaupre - September 11.txt',
        fileSize: fathomContent.length,
        uploadedAt: '2025-09-15T21:21:58.274Z',
      },
      kind: 'text',
      createdAt: new Date(),
      sourceDocumentIds: [],
    };

    vi.mocked(getDocumentById).mockResolvedValue(mockDocument);

    // Mock chunking to return some chunks
    vi.mocked(chunkTranscriptItems).mockResolvedValue([
      {
        topic: 'Introduction',
        startIdx: 0,
        endIdx: 1,
        content:
          "Neil: Welcome everyone to today's meeting\nAndrew: Thanks for having me",
        metadata: {
          startTime: 0,
          endTime: 15,
          speakers: ['Neil', 'Andrew'],
        },
      },
      {
        topic: 'Quarterly Results',
        startIdx: 2,
        endIdx: 3,
        content:
          "Neil: Let's discuss the quarterly results\nAndrew: The numbers look promising",
        metadata: {
          startTime: 90,
          endTime: 165,
          speakers: ['Neil', 'Andrew'],
        },
      },
    ]);

    await syncDocumentToRAG('doc-123');

    // Verify document was fetched
    expect(getDocumentById).toHaveBeenCalledWith({ id: 'doc-123' });

    // Verify chunking was called
    expect(chunkTranscriptItems).toHaveBeenCalled();

    // Verify chunks were written to Pinecone
    expect(mockPineconeClient.writeDocuments).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'doc-123-chunk-0',
          content: expect.stringContaining('Welcome everyone'),
        }),
        expect.objectContaining({
          id: 'doc-123-chunk-1',
          content: expect.stringContaining('quarterly results'),
        }),
      ]),
      { namespace: 'user-456' },
    );
  });

  it('should handle empty chunks gracefully', async () => {
    const fathomContent = `00:00:00 Neil: Welcome`;

    const mockDocument = {
      id: 'doc-456',
      title: 'Short transcript.txt',
      content: fathomContent,
      userId: 'user-789',
      metadata: {
        documentType: 'transcript',
        fileName: 'Short transcript.txt',
        fileSize: fathomContent.length,
        uploadedAt: '2025-09-15T21:21:58.274Z',
      },
      kind: 'text',
      createdAt: new Date(),
      sourceDocumentIds: [],
    };

    vi.mocked(getDocumentById).mockResolvedValue(mockDocument);

    // Mock chunking to return empty array (simulating the issue)
    vi.mocked(chunkTranscriptItems).mockResolvedValue([]);

    await syncDocumentToRAG('doc-456');

    // Should not call writeDocuments when no chunks
    expect(mockPineconeClient.writeDocuments).not.toHaveBeenCalled();
  });

  it('should parse actual Fathom format correctly', () => {
    // Test the parser directly with real Fathom format
    const fathomContent = `00:00:00 Speaker 1: Welcome everyone
00:00:15 Speaker 2: Thanks for having me
00:01:30 Speaker 1: Let's discuss the quarterly results`;

    const items = parseTranscript(fathomContent);

    expect(items).toHaveLength(3);
    expect(items[0]).toEqual({
      timecode: 0,
      speaker: 'Speaker 1',
      text: 'Welcome everyone',
    });
    expect(items[1]).toEqual({
      timecode: 15,
      speaker: 'Speaker 2',
      text: 'Thanks for having me',
    });
    expect(items[2]).toEqual({
      timecode: 90,
      speaker: 'Speaker 1',
      text: "Let's discuss the quarterly results",
    });
  });
});
