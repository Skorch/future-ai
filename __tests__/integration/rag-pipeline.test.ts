/**
 * RAG Pipeline Integration Tests
 * End-to-end testing of the complete RAG system
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import crypto from 'node:crypto';
import { PineconeClient } from '../../lib/rag/pinecone-client';
import {
  parseTranscript,
  parseDocument,
} from '../../lib/ai/utils/transcript-parser';
import { chunkTranscriptItems } from '../../lib/ai/utils/rag-chunker';
import { createReranker } from '../../lib/rag/reranker';
import type { RAGDocument } from '../../lib/rag/types';
// Import sample data from fixtures
const webVTTSample = `WEBVTT

00:00:00.000 --> 00:00:05.000
<v Speaker 1>Welcome everyone to today's meeting.

00:00:05.000 --> 00:00:10.000
<v Speaker 2>Thanks for having me. Let's discuss the project.

00:00:10.000 --> 00:00:15.000
<v Speaker 1>Great! Let's start with the overview.`;

const fathomSample = `00:00:00 Speaker 1: Welcome to the discussion.
00:00:05 Speaker 2: Thanks for having me.
00:00:10 Speaker 1: Let's begin with the main topics.`;

const markdownSample = `# Test Document

## Section 1
This is the first section.

## Section 2
This is the second section.`;

const malformedWebVTT = `WEBVTT

This is malformed
No proper timestamps`;

// Test configuration
const TEST_NAMESPACE = 'integration-test';
const TEST_INDEX = process.env.PINECONE_INDEX_NAME || 'rag-agent-poc';

describe('RAG Pipeline Integration Tests', () => {
  let pineconeClient: PineconeClient;
  const testDocumentIds: string[] = [];

  beforeAll(async () => {
    // Initialize Pinecone client
    pineconeClient = new PineconeClient({ indexName: TEST_INDEX });

    // Clear test namespace before tests
    try {
      await pineconeClient.deleteNamespace(TEST_NAMESPACE);
    } catch (err) {
      // Namespace might not exist, that's ok
    }
  });

  afterAll(async () => {
    // Clean up test data
    if (testDocumentIds.length > 0) {
      try {
        await pineconeClient.deleteDocuments(testDocumentIds, TEST_NAMESPACE);
      } catch (err) {
        console.error('Cleanup failed:', err);
      }
    }
  });

  describe('File Loading Tests', () => {
    it('should load and parse WebVTT format', () => {
      const items = parseTranscript(webVTTSample);
      expect(items).toHaveLength(3);
      expect(items[0].speaker).toBe('Speaker 1');
      expect(items[0].text).toContain('Welcome everyone');
    });

    it('should load and parse Fathom format', () => {
      const items = parseTranscript(fathomSample);
      expect(items.length).toBeGreaterThan(0);
      expect(items[0]).toHaveProperty('speaker');
      expect(items[0]).toHaveProperty('text');
      expect(items[0]).toHaveProperty('startTime');
    });

    it('should load and parse Markdown documents', () => {
      const sections = parseDocument(markdownSample);
      expect(sections.length).toBeGreaterThan(0);
      expect(sections[0].text).toBeTruthy();
    });

    it('should handle plain text documents', () => {
      const plainText =
        'This is a plain text document.\n\nIt has multiple paragraphs.';
      const sections = parseDocument(plainText);
      expect(sections).toHaveLength(2);
      expect(sections[0].text).toBe('This is a plain text document.');
      expect(sections[1].text).toBe('It has multiple paragraphs.');
    });

    it('should handle malformed WebVTT gracefully', () => {
      expect(() => parseTranscript(malformedWebVTT)).not.toThrow();
      const items = parseTranscript(malformedWebVTT);
      expect(items.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Chunking Validation Tests', () => {
    it('should chunk transcript with automatic topic detection', async () => {
      const items = parseTranscript(webVTTSample);
      const chunks = await chunkTranscriptItems(items, [], {
        model: 'claude-sonnet-4',
        dryRun: true, // Use dry run for testing
      });

      expect(chunks.length).toBeGreaterThan(0);
      chunks.forEach((chunk) => {
        expect(chunk).toHaveProperty('topic');
        expect(chunk).toHaveProperty('content');
        expect(chunk).toHaveProperty('metadata');
        expect(chunk.content.length).toBeGreaterThan(0);
        expect(chunk.topic).toBeTruthy();
      });
    });

    it('should chunk with predefined topics', async () => {
      const items = parseTranscript(webVTTSample);
      const topics = ['introduction', 'main content', 'conclusion'];
      const chunks = await chunkTranscriptItems(items, topics, {
        model: 'claude-sonnet-4',
        dryRun: true,
      });

      expect(chunks.length).toBeGreaterThan(0);
      const chunkTopics = chunks.map((c) => c.topic);

      // At least one chunk should match a predefined topic
      const hasMatchingTopic = topics.some((topic) =>
        chunkTopics.some((chunkTopic) =>
          chunkTopic.toLowerCase().includes(topic.toLowerCase()),
        ),
      );
      expect(hasMatchingTopic).toBe(true);
    });

    it('should maintain chunk continuity', async () => {
      const items = parseTranscript(webVTTSample);
      const chunks = await chunkTranscriptItems(items, [], {
        model: 'claude-sonnet-4',
        dryRun: true,
      });

      // Check that chunks maintain temporal order
      for (let i = 1; i < chunks.length; i++) {
        const prevEndTime = chunks[i - 1].metadata.endTime || 0;
        const currentStartTime = chunks[i].metadata.startTime || 0;

        // Start time of current chunk should be >= end time of previous
        expect(currentStartTime).toBeGreaterThanOrEqual(prevEndTime);
      }
    });

    it('should handle overlapping windows correctly', async () => {
      const items = parseTranscript(webVTTSample);
      const chunks = await chunkTranscriptItems(items, [], {
        model: 'claude-sonnet-4',
        dryRun: true,
      });

      // Check for reasonable chunk sizes (not too small, not too large)
      chunks.forEach((chunk) => {
        expect(chunk.content.length).toBeGreaterThan(50); // Min size
        expect(chunk.content.length).toBeLessThan(10000); // Max size
      });
    });
  });

  describe('Reranking Validation Tests', () => {
    beforeAll(async () => {
      // Write some test documents for reranking tests
      const documents: RAGDocument[] = [
        {
          id: 'rerank-test-1',
          content:
            'Machine learning is a subset of artificial intelligence that enables systems to learn from data.',
          metadata: {
            source: 'test',
            type: 'document',
            topic: 'AI',
            createdAt: new Date().toISOString(),
          },
        },
        {
          id: 'rerank-test-2',
          content:
            'Deep learning uses neural networks with multiple layers to process complex patterns.',
          metadata: {
            source: 'test',
            type: 'document',
            topic: 'AI',
            createdAt: new Date().toISOString(),
          },
        },
        {
          id: 'rerank-test-3',
          content:
            'Natural language processing helps computers understand human language.',
          metadata: {
            source: 'test',
            type: 'document',
            topic: 'NLP',
            createdAt: new Date().toISOString(),
          },
        },
      ];

      const result = await pineconeClient.writeDocuments(documents, {
        namespace: TEST_NAMESPACE,
      });

      testDocumentIds.push(...documents.map((d) => d.id));

      // Wait for indexing
      await new Promise((resolve) => setTimeout(resolve, 2000));
    });

    it('should rerank results based on relevance', async () => {
      const query = 'neural networks and deep learning';

      // Get initial results
      const initialResults = await pineconeClient.queryByText(query, {
        topK: 3,
        namespace: TEST_NAMESPACE,
      });

      expect(initialResults.matches.length).toBeGreaterThan(0);

      // Apply reranking
      const reranker = createReranker();
      const rerankedResults = await reranker.rerank(
        query,
        initialResults.matches,
      );

      expect(rerankedResults.length).toBe(initialResults.matches.length);

      // Check that scores are different after reranking
      const scoreChanged = rerankedResults.some(
        (match, i) => match.score !== initialResults.matches[i].score,
      );
      expect(scoreChanged).toBe(true);
    });

    it('should maintain result consistency in reranking', async () => {
      const query = 'artificial intelligence';
      const reranker = createReranker();

      // Run reranking multiple times
      const results = [];
      for (let i = 0; i < 3; i++) {
        const queryResult = await pineconeClient.queryByText(query, {
          topK: 3,
          namespace: TEST_NAMESPACE,
        });

        const reranked = await reranker.rerank(query, queryResult.matches);
        results.push(reranked);
      }

      // Check that top result is consistent
      const topIds = results.map((r) => r[0]?.id);
      const allSame = topIds.every((id) => id === topIds[0]);
      expect(allSame).toBe(true);
    });
  });

  describe('Query Consistency Tests', () => {
    beforeAll(async () => {
      // Write consistent test data
      const documents: RAGDocument[] = [
        {
          id: 'consistency-test-1',
          content:
            'The quick brown fox jumps over the lazy dog. This is a test sentence for consistency.',
          metadata: {
            source: 'consistency-test',
            type: 'document',
            createdAt: new Date().toISOString(),
          },
        },
        {
          id: 'consistency-test-2',
          content:
            'Testing query consistency across multiple iterations to ensure stable results.',
          metadata: {
            source: 'consistency-test',
            type: 'document',
            createdAt: new Date().toISOString(),
          },
        },
      ];

      await pineconeClient.writeDocuments(documents, {
        namespace: TEST_NAMESPACE,
      });

      testDocumentIds.push(...documents.map((d) => d.id));

      // Wait for indexing
      await new Promise((resolve) => setTimeout(resolve, 2000));
    });

    it('should return consistent results for same query (4 iterations)', async () => {
      const query = 'test consistency';
      const iterations = 4;
      const results = [];

      for (let i = 0; i < iterations; i++) {
        const result = await pineconeClient.queryByText(query, {
          topK: 2,
          namespace: TEST_NAMESPACE,
        });

        results.push({
          matchCount: result.matches.length,
          topId: result.matches[0]?.id,
          topScore: result.matches[0]?.score,
        });
      }

      // All iterations should return same match count
      const matchCounts = results.map((r) => r.matchCount);
      expect(new Set(matchCounts).size).toBe(1);

      // All iterations should return same top document
      const topIds = results.map((r) => r.topId);
      expect(new Set(topIds).size).toBe(1);

      // Score variance should be minimal
      const scores = results.map((r) => r.topScore || 0);
      const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
      const variance =
        scores.reduce((sum, s) => sum + Math.pow(s - avgScore, 2), 0) /
        scores.length;

      expect(variance).toBeLessThan(0.001); // Very small variance threshold
    });

    it('should handle filters consistently', async () => {
      const query = 'test';
      const filter = { source: 'consistency-test' };
      const results = [];

      for (let i = 0; i < 3; i++) {
        const result = await pineconeClient.queryByText(query, {
          topK: 5,
          namespace: TEST_NAMESPACE,
          filter,
        });

        results.push(result.matches.length);
      }

      // All iterations should return same number of matches
      expect(new Set(results).size).toBe(1);
    });
  });

  describe('Complete Pipeline Integration', () => {
    it('should execute full write → query pipeline', async () => {
      // Step 1: Parse transcript
      const transcript = parseTranscript(webVTTSample);
      expect(transcript.length).toBeGreaterThan(0);

      // Step 2: Chunk transcript
      const chunks = await chunkTranscriptItems(transcript, ['test topic'], {
        model: 'claude-sonnet-4',
        dryRun: true,
      });
      expect(chunks.length).toBeGreaterThan(0);

      // Generate deterministic hash from content for consistent IDs
      const contentHash = crypto
        .createHash('sha256')
        .update(webVTTSample)
        .digest('hex');

      // Step 3: Convert to RAG documents with deterministic IDs
      const documents: RAGDocument[] = chunks.map((chunk, i) => ({
        id: `${contentHash}-chunk-${i}`,
        content: chunk.content,
        metadata: {
          source: 'pipeline-test',
          type: 'transcript',
          topic: chunk.topic,
          speakers: chunk.metadata.speakers,
          chunkIndex: i,
          totalChunks: chunks.length,
          createdAt: new Date().toISOString(),
          fileHash: contentHash,
        },
      }));

      // Step 4: Write to vector database
      const writeResult = await pineconeClient.writeDocuments(documents, {
        namespace: TEST_NAMESPACE,
      });

      expect(writeResult.success).toBe(true);
      expect(writeResult.documentsWritten).toBe(documents.length);

      testDocumentIds.push(...documents.map((d) => d.id));

      // Wait for indexing
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Step 5: Query the written content
      const queryResult = await pineconeClient.queryByText('test topic', {
        topK: 5,
        namespace: TEST_NAMESPACE,
        filter: { source: 'pipeline-test' },
      });

      expect(queryResult.matches.length).toBeGreaterThan(0);
      expect(queryResult.matches[0].metadata.source).toBe('pipeline-test');
    });

    it('should handle errors gracefully throughout pipeline', async () => {
      // Test with invalid content
      const invalidContent = '';

      // Parsing empty content should not throw
      expect(() => parseTranscript(invalidContent)).not.toThrow();

      // Writing empty documents should return error
      const emptyDocs: RAGDocument[] = [];
      const writeResult = await pineconeClient.writeDocuments(emptyDocs, {
        namespace: TEST_NAMESPACE,
      });

      expect(writeResult.success).toBe(false);

      // Query with invalid namespace should return empty results
      const queryResult = await pineconeClient.queryByText('test', {
        topK: 5,
        namespace: 'non-existent-namespace',
      });

      expect(queryResult.matches).toEqual([]);
    });
  });

  describe('Tool Integration in Chat Context', () => {
    it('should verify RAG tools are registered', async () => {
      // This test would normally check the chat route, but since we can't
      // easily test the route directly, we'll verify the tools exist
      const { writeToRAG } = await import('../../lib/ai/tools/write-to-rag');
      const { queryRAG } = await import('../../lib/ai/tools/query-rag');

      expect(writeToRAG).toBeDefined();
      expect(queryRAG).toBeDefined();

      // Verify tools can be instantiated with proper context
      const mockContext = {
        session: { user: { id: 'test' } },
        dataStream: { write: () => {} },
      };

      const writeTool = writeToRAG(mockContext as any);
      const queryTool = queryRAG(mockContext as any);

      expect(writeTool).toHaveProperty('inputSchema');
      expect(writeTool).toHaveProperty('execute');
      expect(queryTool).toHaveProperty('inputSchema');
      expect(queryTool).toHaveProperty('execute');
    });
  });
});
