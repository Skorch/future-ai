import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PineconeClient } from '../../lib/rag/pinecone-client';
import type { RAGDocument } from '../../lib/rag/types';

// Mock Pinecone SDK
// Mock types for Pinecone SDK
type MockNamespace = {
  upsert: ReturnType<typeof vi.fn>;
  query: ReturnType<typeof vi.fn>;
  deleteAll: ReturnType<typeof vi.fn>;
  deleteMany: ReturnType<typeof vi.fn>;
};

type MockIndex = {
  namespace: ReturnType<typeof vi.fn>;
  describeIndexStats: ReturnType<typeof vi.fn>;
};

type MockPineconeInstance = {
  index: ReturnType<typeof vi.fn>;
  listIndexes: ReturnType<typeof vi.fn>;
  describeIndex: ReturnType<typeof vi.fn>;
  createIndex: ReturnType<typeof vi.fn>;
};

vi.mock('@pinecone-database/pinecone', () => {
  const mockNamespace: MockNamespace = {
    upsert: vi.fn().mockResolvedValue({}),
    query: vi.fn().mockResolvedValue({ matches: [] }),
    deleteAll: vi.fn().mockResolvedValue({}),
    deleteMany: vi.fn().mockResolvedValue({}),
  };

  const mockIndex: MockIndex = {
    namespace: vi.fn(() => mockNamespace),
    describeIndexStats: vi.fn().mockResolvedValue({
      dimension: 1536,
      indexFullness: 0.5,
      totalRecordCount: 1000,
      namespaces: {
        default: { recordCount: 500 },
        test: { recordCount: 500 },
      },
    }),
  };

  return {
    Pinecone: vi.fn().mockImplementation(
      (): MockPineconeInstance => ({
        index: vi.fn(() => mockIndex),
        listIndexes: vi.fn().mockResolvedValue({
          indexes: [{ name: 'rag-index' }],
        }),
        describeIndex: vi.fn().mockResolvedValue({
          status: { ready: true },
        }),
        createIndex: vi.fn().mockResolvedValue({}),
      }),
    ),
  };
});

describe('PineconeClient', () => {
  let client: PineconeClient;
  let mockPineconeInstance: MockPineconeInstance;
  const originalEnv = process.env;

  beforeEach(() => {
    // Set test environment variables
    process.env = {
      ...originalEnv,
      PINECONE_API_KEY: 'test-api-key',
      PINECONE_INDEX_NAME: 'test-index',
    };

    vi.clearAllMocks();

    // Get reference to mock instance for test-specific setup
    const { Pinecone } = require('@pinecone-database/pinecone');
    mockPineconeInstance = new Pinecone({ apiKey: 'test' });

    client = new PineconeClient();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('constructor', () => {
    it('should throw error if no API key is provided', () => {
      process.env.PINECONE_API_KEY = undefined;
      expect(() => new PineconeClient()).toThrow(
        'Pinecone API key is required',
      );
    });

    it('should accept config override', () => {
      const customClient = new PineconeClient({
        apiKey: 'custom-key',
        indexName: 'custom-index',
      });
      expect(customClient).toBeDefined();
    });
  });

  describe('writeDocuments', () => {
    const mockDocuments: RAGDocument[] = [
      {
        id: 'doc1',
        content: 'Test content 1',
        embedding: Array(1536).fill(0.1),
        metadata: {
          source: 'test.txt',
          type: 'document',
          createdAt: new Date().toISOString(),
        },
      },
      {
        id: 'doc2',
        content: 'Test content 2',
        embedding: Array(1536).fill(0.2),
        metadata: {
          source: 'test.txt',
          type: 'document',
          createdAt: new Date().toISOString(),
        },
      },
    ];

    it('should write documents successfully', async () => {
      const result = await client.writeDocuments(mockDocuments);

      expect(result.success).toBe(true);
      expect(result.documentsWritten).toBe(2);
      expect(result.namespace).toBe('default');
      expect(result.errors).toBeUndefined();
    });

    it('should handle empty documents array', async () => {
      const result = await client.writeDocuments([]);

      expect(result.success).toBe(true);
      expect(result.documentsWritten).toBe(0);
    });

    it('should filter out documents without embeddings', async () => {
      const docsWithoutEmbeddings: RAGDocument[] = [
        {
          id: 'doc1',
          content: 'No embedding',
          metadata: {
            source: 'test.txt',
            type: 'document',
            createdAt: new Date().toISOString(),
          },
        },
      ];

      const result = await client.writeDocuments(docsWithoutEmbeddings);

      expect(result.documentsWritten).toBe(0);
      expect(result.errors).toContain('Batch 1: No valid embeddings');
    });

    it('should process documents in batches', async () => {
      const manyDocs = Array.from({ length: 150 }, (_, i) => ({
        id: `doc${i}`,
        content: `Content ${i}`,
        embedding: Array(1536).fill(0.1),
        metadata: {
          source: 'test.txt',
          type: 'document' as const,
          createdAt: new Date().toISOString(),
        },
      }));

      const result = await client.writeDocuments(manyDocs, { batchSize: 100 });

      expect(result.success).toBe(true);
      expect(result.documentsWritten).toBe(150);
    });

    it('should call progress callback', async () => {
      const progressCallback = vi.fn();

      await client.writeDocuments(mockDocuments, { progressCallback });

      expect(progressCallback).toHaveBeenCalled();
      expect(progressCallback).toHaveBeenCalledWith(expect.any(Number));
    });
  });

  describe('query', () => {
    const mockVector = Array(1536).fill(0.1);

    it('should query successfully with default options', async () => {
      const { Pinecone } = await import('@pinecone-database/pinecone');
      const mockInstance = new Pinecone({ apiKey: 'test' });
      const mockIndex = mockInstance.index('test');
      const mockNamespace = mockIndex.namespace('default');

      vi.mocked(mockNamespace.query).mockResolvedValueOnce({
        matches: [
          {
            id: 'doc1',
            score: 0.9,
            metadata: {
              content: 'Test content',
              source: 'test.txt',
              type: 'document',
              createdAt: new Date().toISOString(),
            },
          },
        ],
      } as any);

      const result = await client.query(mockVector);

      expect(result.matches).toHaveLength(1);
      expect(result.matches[0].id).toBe('doc1');
      expect(result.matches[0].score).toBe(0.9);
      expect(result.namespace).toBe('default');
    });

    it('should filter results by minimum score', async () => {
      const { Pinecone } = await import('@pinecone-database/pinecone');
      const mockInstance = new Pinecone({ apiKey: 'test' });
      const mockIndex = mockInstance.index('test');
      const mockNamespace = mockIndex.namespace('default');

      vi.mocked(mockNamespace.query).mockResolvedValueOnce({
        matches: [
          { id: 'doc1', score: 0.9, metadata: {} },
          { id: 'doc2', score: 0.5, metadata: {} },
          { id: 'doc3', score: 0.3, metadata: {} },
        ],
      } as any);

      const result = await client.query(mockVector, { minScore: 0.6 });

      expect(result.matches).toHaveLength(1);
      expect(result.matches[0].score).toBeGreaterThanOrEqual(0.6);
    });

    it('should pass through query options', async () => {
      const { Pinecone } = await import('@pinecone-database/pinecone');
      const mockInstance = new Pinecone({ apiKey: 'test' });
      const mockIndex = mockInstance.index('test');
      const mockNamespace = mockIndex.namespace('custom');

      await client.query(mockVector, {
        namespace: 'custom',
        topK: 5,
        filter: { type: 'document' },
      });

      expect(mockNamespace.query).toHaveBeenCalledWith({
        vector: mockVector,
        topK: 5,
        filter: { type: 'document' },
        includeMetadata: true,
      });
    });
  });

  describe('queryByText', () => {
    it('should convert text to vector and query', async () => {
      const mockEmbedder = vi.fn().mockResolvedValue(Array(1536).fill(0.1));

      const result = await client.queryByText('test query', mockEmbedder);

      expect(mockEmbedder).toHaveBeenCalledWith('test query');
      expect(result).toBeDefined();
    });
  });

  describe('deleteNamespace', () => {
    it('should delete namespace', async () => {
      const { Pinecone } = await import('@pinecone-database/pinecone');
      const mockInstance = new Pinecone({ apiKey: 'test' });
      const mockIndex = mockInstance.index('test');
      const mockNamespace = mockIndex.namespace('test-namespace');

      await client.deleteNamespace('test-namespace');

      expect(mockNamespace.deleteAll).toHaveBeenCalled();
    });
  });

  describe('deleteDocuments', () => {
    it('should delete specific documents', async () => {
      const { Pinecone } = await import('@pinecone-database/pinecone');
      const mockInstance = new Pinecone({ apiKey: 'test' });
      const mockIndex = mockInstance.index('test');
      const mockNamespace = mockIndex.namespace('default');

      await client.deleteDocuments(['doc1', 'doc2']);

      expect(mockNamespace.deleteMany).toHaveBeenCalledWith(['doc1', 'doc2']);
    });

    it('should handle empty array', async () => {
      const { Pinecone } = await import('@pinecone-database/pinecone');
      const mockInstance = new Pinecone({ apiKey: 'test' });
      const mockIndex = mockInstance.index('test');
      const mockNamespace = mockIndex.namespace('default');

      await client.deleteDocuments([]);

      expect(mockNamespace.deleteMany).not.toHaveBeenCalled();
    });
  });

  describe('getStats', () => {
    it('should return index statistics', async () => {
      const stats = await client.getStats();

      expect(stats.dimension).toBe(1536);
      expect(stats.indexFullness).toBe(0.5);
      expect(stats.totalVectorCount).toBe(1000);
      expect(stats.namespaces).toEqual({
        default: { vectorCount: 500 },
        test: { vectorCount: 500 },
      });
    });
  });

  describe('indexExists', () => {
    it('should return true if index exists', async () => {
      vi.mocked(mockPineconeInstance.listIndexes).mockResolvedValueOnce({
        indexes: [{ name: 'test-index' }],
      } as any);

      const exists = await client.indexExists();
      expect(exists).toBe(true);
    });

    it('should return false if index does not exist', async () => {
      vi.mocked(mockPineconeInstance.listIndexes).mockResolvedValueOnce({
        indexes: [{ name: 'other-index' }],
      } as any);

      const exists = await client.indexExists();
      expect(exists).toBe(false);
    });
  });

  describe('createIndexIfNotExists', () => {
    it('should create index if it does not exist', async () => {
      vi.mocked(mockPineconeInstance.listIndexes).mockResolvedValueOnce({
        indexes: [],
      } as any);

      await client.createIndexIfNotExists();

      expect(mockPineconeInstance.createIndex).toHaveBeenCalledWith({
        name: 'test-index',
        dimension: 1536,
        metric: 'cosine',
        spec: {
          serverless: {
            cloud: 'aws',
            region: 'us-east-1',
          },
        },
      });
    });

    it('should not create index if it already exists', async () => {
      vi.mocked(mockPineconeInstance.listIndexes).mockResolvedValueOnce({
        indexes: [{ name: 'test-index' }],
      } as any);

      await client.createIndexIfNotExists();

      expect(mockPineconeInstance.createIndex).not.toHaveBeenCalled();
    });
  });
});
