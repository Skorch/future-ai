import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Create mock Pinecone client instance using vi.hoisted
const { mockPineconeClient } = vi.hoisted(() => {
  return {
    mockPineconeClient: {
      writeDocuments: vi.fn().mockResolvedValue({ success: true }),
      deleteByMetadata: vi.fn().mockResolvedValue({ success: true }),
      getIndexStats: vi.fn().mockResolvedValue({ dimension: 1024 }),
    },
  };
});

// Mock dependencies before importing modules that use them
vi.mock('../pinecone-client', () => ({
  PineconeClient: vi.fn(() => mockPineconeClient),
}));
vi.mock('@/lib/ai/utils/rag-chunker');
vi.mock('@/lib/ai/utils/transcript-parser');
vi.mock('@/lib/artifacts', () => ({
  getDocumentTypeDefinition: vi.fn(),
  artifactRegistry: {},
}));

// Now import after mocks are set up
import { syncDocumentToRAG, deleteFromRAG } from '../sync';
import { chunkTranscriptItems } from '@/lib/ai/utils/rag-chunker';
import {
  parseTranscript,
  parseDocument,
} from '@/lib/ai/utils/transcript-parser';

// Test data factories
const createMockDocument = (overrides = {}) => ({
  id: 'doc-123',
  workspaceId: 'workspace-123',
  title: 'Test Document',
  content: 'Sample transcript content',
  documentType: 'transcript',
  kind: 'text',
  metadata: { topics: ['topic1', 'topic2'] },
  createdByUserId: 'user-123',
  createdAt: new Date(),
  ...overrides,
});

const createMockChunk = (docId: string, index: number) => ({
  id: `${docId}-chunk-${index}`,
  content: `Chunk ${index} content`,
  topic: `Topic ${index}`,
  metadata: {
    documentId: docId,
    chunkIndex: index,
    speakers: ['Speaker A', 'Speaker B'],
  },
});

const createMockTranscriptItem = (index: number) => ({
  timecode: index * 10,
  speaker: `Speaker ${index % 2 === 0 ? 'A' : 'B'}`,
  text: `This is transcript item ${index}`,
});

describe('RAG Sync Operations', () => {
  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Setup default mock responses
    vi.mocked(parseTranscript).mockReturnValue([
      createMockTranscriptItem(0),
      createMockTranscriptItem(1),
      createMockTranscriptItem(2),
    ]);

    vi.mocked(chunkTranscriptItems).mockResolvedValue([
      createMockChunk('doc-123', 0),
      createMockChunk('doc-123', 1),
    ]);

    vi.mocked(parseDocument).mockReturnValue([
      { timecode: 0, speaker: 'Section 1', text: 'Section 1 content' },
      { timecode: 1, speaker: 'Section 2', text: 'Section 2 content' },
    ]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('syncDocumentToRAG', () => {
    it('should sync transcript document with AI-powered chunking', async () => {
      const mockDoc = createMockDocument();

      await syncDocumentToRAG(mockDoc);

      // Verify transcript was parsed
      expect(parseTranscript).toHaveBeenCalledWith(mockDoc.content);

      // Verify AI chunking was called
      expect(chunkTranscriptItems).toHaveBeenCalledWith(
        expect.any(Array),
        ['topic1', 'topic2'],
        { model: 'claude-sonnet-4', dryRun: false },
      );

      // Verify chunks were written to Pinecone
      expect(mockPineconeClient.writeDocuments).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            id: 'doc-123-chunk-0',
            metadata: expect.objectContaining({
              documentId: 'doc-123',
              documentType: 'transcript',
              topic: 'Topic 0',
            }),
          }),
        ]),
        { namespace: 'workspace-123' },
      );
    });

    it('should sync meeting-summary document with section-based chunking', async () => {
      const mockDoc = createMockDocument({
        documentType: 'meeting-summary',
        metadata: {
          sourceDocumentIds: ['doc-1', 'doc-2'],
        },
      });

      await syncDocumentToRAG(mockDoc);

      // Verify document parsing
      expect(parseDocument).toHaveBeenCalledWith(mockDoc.content);

      // Verify chunks were written with proper metadata
      expect(mockPineconeClient.writeDocuments).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            id: 'doc-123-section-0',
            metadata: expect.objectContaining({
              documentId: 'doc-123',
              documentType: 'meeting-summary',
              sectionTitle: 'Section 1',
              sourceTranscriptIds: ['doc-1', 'doc-2'],
            }),
          }),
        ]),
        { namespace: 'workspace-123' },
      );
    });

    it('should handle documents without content', async () => {
      const mockDoc = createMockDocument({ content: '' });

      await syncDocumentToRAG(mockDoc);

      // Should exit early without calling Pinecone
      expect(mockPineconeClient.writeDocuments).not.toHaveBeenCalled();
    });

    it('should implement UPSERT pattern (delete before insert)', async () => {
      const mockDoc = createMockDocument();

      await syncDocumentToRAG(mockDoc);

      // Verify delete was called before write
      expect(mockPineconeClient.deleteByMetadata).toHaveBeenCalledBefore(
        mockPineconeClient.writeDocuments as any,
      );
      expect(mockPineconeClient.deleteByMetadata).toHaveBeenCalledWith(
        {
          documentId: { $eq: 'doc-123' },
        },
        'workspace-123',
      );
    });

    it('should handle empty transcript gracefully', async () => {
      const mockDoc = createMockDocument();
      vi.mocked(parseTranscript).mockReturnValue([]);
      vi.mocked(chunkTranscriptItems).mockResolvedValue([]);

      await syncDocumentToRAG(mockDoc);

      // Should handle empty chunks without error
      expect(mockPineconeClient.writeDocuments).not.toHaveBeenCalled();
    });

    it('should not throw on Pinecone errors', async () => {
      const mockDoc = createMockDocument();
      mockPineconeClient.writeDocuments.mockRejectedValue(
        new Error('Pinecone error'),
      );

      // Should not throw
      await expect(syncDocumentToRAG(mockDoc)).resolves.not.toThrow();
    });

    it('should handle transcript parsing errors gracefully', async () => {
      const mockDoc = createMockDocument();
      vi.mocked(parseTranscript).mockImplementation(() => {
        throw new Error('Invalid transcript format');
      });

      // Should not throw
      await expect(syncDocumentToRAG(mockDoc)).resolves.not.toThrow();

      // Should not attempt to write to Pinecone
      expect(mockPineconeClient.writeDocuments).not.toHaveBeenCalled();
    });
  });

  describe('deleteFromRAG', () => {
    it('should delete all chunks for a document', async () => {
      await deleteFromRAG('doc-123', 'workspace-123');

      expect(mockPineconeClient.deleteByMetadata).toHaveBeenCalledWith(
        {
          documentId: { $eq: 'doc-123' },
        },
        'workspace-123',
      );
    });

    it('should handle deletion errors gracefully', async () => {
      mockPineconeClient.deleteByMetadata.mockRejectedValue(
        new Error('Delete failed'),
      );

      // Should not throw
      await expect(
        deleteFromRAG('doc-123', 'workspace-123'),
      ).resolves.not.toThrow();
    });

    it('should handle already deleted documents', async () => {
      mockPineconeClient.deleteByMetadata.mockResolvedValue({ deleted: 0 });

      await deleteFromRAG('doc-123', 'workspace-123');

      // Should complete without error
      expect(mockPineconeClient.deleteByMetadata).toHaveBeenCalled();
    });
  });

  describe('function exports', () => {
    it('should export sync and delete functions', () => {
      expect(syncDocumentToRAG).toBeDefined();
      expect(deleteFromRAG).toBeDefined();
    });
  });

  describe('Edge Cases', () => {
    it('should handle documents with missing metadata', async () => {
      const mockDoc = createMockDocument({ metadata: {} });

      await syncDocumentToRAG(mockDoc);

      // Should use default values
      expect(chunkTranscriptItems).toHaveBeenCalledWith(
        expect.any(Array),
        [], // Empty topics array
        expect.any(Object),
      );
    });

    it('should handle summary documents without sourceDocumentIds', async () => {
      const mockDoc = createMockDocument({
        documentType: 'meeting-summary',
        metadata: {},
      });

      await syncDocumentToRAG(mockDoc);

      // Should still process but with empty sourceTranscriptIds
      expect(mockPineconeClient.writeDocuments).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            metadata: expect.objectContaining({
              sourceTranscriptIds: [],
            }),
          }),
        ]),
        expect.any(Object),
      );
    });

    it('should handle very large documents by chunking appropriately', async () => {
      const largeContent = 'Large content '.repeat(1000);
      const mockDoc = createMockDocument({ content: largeContent });

      // Mock chunker to return multiple chunks
      const manyChunks = Array.from({ length: 10 }, (_, i) =>
        createMockChunk('doc-123', i),
      );
      vi.mocked(chunkTranscriptItems).mockResolvedValue(manyChunks);

      await syncDocumentToRAG(mockDoc);

      // Verify all chunks were processed
      expect(mockPineconeClient.writeDocuments).toHaveBeenCalledWith(
        expect.arrayContaining(
          manyChunks.map((_, index) =>
            expect.objectContaining({
              id: `doc-123-chunk-${index}`,
              metadata: expect.objectContaining({
                totalChunks: 10,
              }),
            }),
          ),
        ),
        expect.any(Object),
      );
    });
  });
});
