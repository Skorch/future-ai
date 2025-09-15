import { tool, type UIMessageStreamWriter } from 'ai';
import { z } from 'zod';
import { PineconeClient } from '../../rag/pinecone-client';
import { createReranker } from '../../rag/reranker';
import type { QueryResult, QueryMatch, RAGMetadata } from '../../rag/types';
import type { Session } from 'next-auth';
import type { ChatMessage } from '@/lib/types';

// Tool parameter schema
const queryRAGSchema = z.object({
  query: z.string().describe('Search query to find relevant content'),
  contentType: z
    .enum(['transcript', 'summary', 'all'])
    .optional()
    .default('all')
    .describe('Filter results by content type'),
  namespace: z
    .string()
    .optional()
    .default('default')
    .describe('Namespace to search within'),
  topK: z
    .number()
    .min(1)
    .max(20)
    .optional()
    .default(5)
    .describe('Number of results to return'),
  filter: z
    .object({
      source: z.string().optional().describe('Filter by source identifier'),
      topics: z.array(z.string()).optional().describe('Filter by topics'),
      speakers: z
        .array(z.string())
        .optional()
        .describe('Filter by speakers (for transcripts)'),
      dateRange: z
        .object({
          start: z.string().describe('ISO date string'),
          end: z.string().describe('ISO date string'),
        })
        .optional()
        .describe('Filter by date range'),
    })
    .optional()
    .describe('Additional filters for search'),
  expandContext: z
    .boolean()
    .optional()
    .default(false)
    .describe('Include adjacent chunks for more context'),
  useReranking: z
    .boolean()
    .optional()
    .default(true)
    .describe('Apply reranking to improve result relevance'),
});

type QueryRAGParams = z.infer<typeof queryRAGSchema>;

// Simple in-memory cache for query results
const queryCache = new Map<string, { result: unknown; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Build Pinecone filter object from parameters
 */
function buildPineconeFilter(
  params: QueryRAGParams,
): Record<string, unknown> | undefined {
  const filters: Record<string, unknown> = {};

  // Content type filter
  if (params.contentType && params.contentType !== 'all') {
    filters.type = params.contentType;
  }

  // Source filter
  if (params.filter?.source) {
    filters.source = params.filter.source;
  }

  // Topics filter (using $in operator for array matching)
  if (params.filter?.topics && params.filter.topics.length > 0) {
    filters.topic = { $in: params.filter.topics };
  }

  // Speakers filter (for transcripts)
  if (params.filter?.speakers && params.filter.speakers.length > 0) {
    filters.speakers = { $in: params.filter.speakers };
  }

  // Date range filter
  if (params.filter?.dateRange) {
    filters.createdAt = {
      $gte: params.filter.dateRange.start,
      $lte: params.filter.dateRange.end,
    };
  }

  return Object.keys(filters).length > 0 ? filters : undefined;
}

/**
 * Expand context by fetching adjacent chunks
 */
async function expandChunkContext(
  matches: QueryMatch[],
  pineconeClient: PineconeClient,
  namespace: string,
): Promise<QueryMatch[]> {
  const expandedMatches: QueryMatch[] = [];
  const processedIds = new Set<string>();

  for (const match of matches) {
    // Add the original match
    if (!processedIds.has(match.id)) {
      expandedMatches.push(match);
      processedIds.add(match.id);
    }

    // If this is a chunked document, try to fetch adjacent chunks
    if (match.metadata.chunkIndex !== undefined && match.metadata.fileHash) {
      // These IDs would be used for fetching specific chunks if needed
      // const prevChunkId = `${match.metadata.fileHash}-chunk-${match.metadata.chunkIndex - 1}`;
      // const nextChunkId = `${match.metadata.fileHash}-chunk-${match.metadata.chunkIndex + 1}`;

      // Fetch adjacent chunks if they exist
      const adjacentFilter = {
        fileHash: match.metadata.fileHash,
        chunkIndex: {
          $in: [match.metadata.chunkIndex - 1, match.metadata.chunkIndex + 1],
        },
      };

      try {
        // Query for adjacent chunks using a simple filter
        const adjacentResult = await pineconeClient.query(
          [], // Empty vector for metadata-only query
          {
            namespace,
            filter: adjacentFilter,
            topK: 2,
            includeMetadata: true,
          },
        );

        for (const adjacent of adjacentResult.matches) {
          if (!processedIds.has(adjacent.id)) {
            expandedMatches.push({
              ...adjacent,
              score: match.score * 0.8, // Slightly lower score for context chunks
            });
            processedIds.add(adjacent.id);
          }
        }
      } catch (error) {
        console.error('Failed to fetch adjacent chunks:', error);
      }
    }
  }

  // Sort by file/chunk order for better readability
  return expandedMatches.sort((a, b) => {
    // First sort by file hash
    if (a.metadata.fileHash && b.metadata.fileHash) {
      const fileCompare = a.metadata.fileHash.localeCompare(
        b.metadata.fileHash,
      );
      if (fileCompare !== 0) return fileCompare;
    }
    // Then by chunk index
    if (
      a.metadata.chunkIndex !== undefined &&
      b.metadata.chunkIndex !== undefined
    ) {
      return a.metadata.chunkIndex - b.metadata.chunkIndex;
    }
    // Finally by score
    return b.score - a.score;
  });
}

/**
 * Format results for LLM consumption
 */
function formatResultsForLLM(matches: QueryMatch[]): string {
  if (matches.length === 0) {
    return 'No relevant content found.';
  }

  const formatted = matches
    .map((match, index) => {
      const metadata = match.metadata;
      let header = `[Result ${index + 1}]`;

      if (metadata.type === 'transcript' && metadata.speakers) {
        header += ` (${metadata.speakers.join(', ')})`;
      }
      if (metadata.topic) {
        header += ` - Topic: ${metadata.topic}`;
      }
      if (metadata.source) {
        header += ` - Source: ${metadata.source}`;
      }

      return `${header}\n${match.content}\n`;
    })
    .join('\n---\n\n');

  return formatted;
}

/**
 * Query-RAG Tool
 * Searches the vector database for relevant content
 */
interface QueryRAGProps {
  session: Session;
  dataStream: UIMessageStreamWriter<ChatMessage>;
}

export const queryRAG = (_props: QueryRAGProps) =>
  tool({
    description:
      'Search the RAG system for relevant content using semantic search',
    inputSchema: queryRAGSchema,
    execute: async (params) => {
      const startTime = Date.now();

      try {
        // Check cache first
        const cacheKey = JSON.stringify(params);
        const cached = queryCache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
          return cached.result;
        }

        // Initialize Pinecone client
        const pineconeClient = new PineconeClient({
          indexName: process.env.PINECONE_INDEX_NAME || 'rag-agent-poc',
        });

        // Build filter from parameters
        const filter = buildPineconeFilter(params);

        // Query Pinecone with text (integrated embeddings handle conversion)
        const queryResult: QueryResult = await pineconeClient.queryByText(
          params.query,
          {
            namespace: params.namespace,
            topK: params.topK * 2, // Get more results for reranking
            filter,
            includeMetadata: true,
            minScore: 0.5, // Minimum relevance threshold
          },
        );

        let matches = queryResult.matches;

        // Apply reranking if enabled and we have results
        if (params.useReranking && matches.length > 0) {
          const reranker = createReranker();
          const rerankedResults = await reranker.rerank(params.query, matches, {
            model: 'cohere-rerank-3.5',
            topN: params.topK,
            returnDocuments: true,
          });

          // Convert reranked results back to QueryMatch format
          matches = rerankedResults.map((result) => ({
            id: result.id,
            score: result.score,
            content: result.content,
            metadata: result.metadata as RAGMetadata,
          }));
        } else {
          // Just take the top K without reranking
          matches = matches.slice(0, params.topK);
        }

        // Expand context if requested
        if (params.expandContext && matches.length > 0) {
          matches = await expandChunkContext(
            matches,
            pineconeClient,
            params.namespace,
          );
        }

        // Format results for LLM
        const formattedContent = formatResultsForLLM(matches);

        const duration = Date.now() - startTime;

        const result = {
          success: true,
          query: params.query,
          matchCount: matches.length,
          namespace: params.namespace,
          duration: `${duration}ms`,
          content: formattedContent,
          matches: matches.map((m) => ({
            id: m.id,
            score: m.score,
            content: `${m.content.substring(0, 200)}...`, // Preview only
            metadata: m.metadata,
          })),
        };

        // Cache the result
        queryCache.set(cacheKey, { result, timestamp: Date.now() });

        return result;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';

        return {
          success: false,
          error: errorMessage,
          query: params.query,
        };
      }
    },
  });
