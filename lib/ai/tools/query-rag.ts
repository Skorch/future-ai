import { tool, type UIMessageStreamWriter } from 'ai';
import { z } from 'zod';
import { PineconeClient } from '../../rag/pinecone-client';
import { createReranker } from '../../rag/reranker';
import type { QueryResult, QueryMatch, RAGMetadata } from '../../rag/types';
import type { Session } from 'next-auth';
import type { ChatMessage } from '@/lib/types';

// Tool parameter schema - only expose what LLM needs to control
const queryRAGSchema = z.object({
  query: z.string().describe('Search query to find relevant content'),
  contentType: z
    .enum(['transcript', 'meeting-summary', 'document', 'all'])
    .optional()
    .default('all')
    .describe(
      'Filter results by content type (transcript for raw transcripts, meeting-summary for AI-generated summaries, document for other text)',
    ),
  filter: z
    .object({
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

  // Content type filter - use documentType field directly
  if (params.contentType && params.contentType !== 'all') {
    filters.documentType = params.contentType;
  }

  // Topics filter (using $in operator for array matching)
  if (params.filter?.topics && params.filter.topics.length > 0) {
    filters.topic = { $in: params.filter.topics };
  }

  // Speakers filter (for transcripts)
  if (params.filter?.speakers && params.filter.speakers.length > 0) {
    filters.speakers = { $in: params.filter.speakers };
  }

  // Date range filter - use meetingDate field (stored as ISO string)
  if (params.filter?.dateRange) {
    // Keep as ISO strings for Pinecone string comparison
    const startDate = new Date(params.filter.dateRange.start).toISOString();
    const endDate = new Date(params.filter.dateRange.end).toISOString();

    // Only add filter if dates are valid
    if (!startDate.includes('Invalid') && !endDate.includes('Invalid')) {
      filters.meetingDate = {
        $gte: startDate,
        $lte: endDate,
      };
    }
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

      // Build source citation
      const source = {
        doc: metadata.title || 'Unknown Document',
        type: metadata.documentType || 'document',
        section:
          metadata.sectionTitle ||
          metadata.topic ||
          `Chunk ${metadata.chunkIndex}`,
        speakers: metadata.speakers,
        date: metadata.meetingDate || metadata.createdAt,
      };

      // Format as citation block
      let citation = `📍 Source [${index + 1}]: ${source.doc}`;
      if (source.type === 'transcript' && source.speakers) {
        citation += ` | Speakers: ${source.speakers.join(', ')}`;
      }
      if (source.section) {
        citation += ` | Section: ${source.section}`;
      }
      if (source.date) {
        const dateStr =
          typeof source.date === 'string'
            ? source.date.split('T')[0]
            : new Date(source.date).toISOString().split('T')[0];
        citation += ` | Date: ${dateStr}`;
      }
      citation += ` | Relevance: ${(match.score * 100).toFixed(1)}%`;

      return `${citation}\n\n${match.content}\n`;
    })
    .join(`\n${'─'.repeat(80)}\n\n`);

  // Add instructions for the LLM on how to cite sources
  const instructions = `When using this information, cite sources using this format: [Source N] where N is the source number above.\n\n`;

  return instructions + formatted;
}

/**
 * Query-RAG Tool
 * Searches the vector database for relevant content
 */
interface QueryRAGProps {
  session: Session;
  dataStream: UIMessageStreamWriter<ChatMessage>;
}

export const queryRAG = (props: QueryRAGProps) => {
  console.log(
    '[queryRAG] Creating tool with session user:',
    props.session?.user?.id,
  );

  return tool({
    description:
      'Search the RAG system for relevant content using semantic search',
    inputSchema: queryRAGSchema,
    execute: async (params) => {
      console.log('[queryRAG] Tool invoked with params:', params);
      console.log('[queryRAG] Session user:', props.session?.user?.id);
      const startTime = Date.now();

      try {
        // Check cache first
        const cacheKey = JSON.stringify(params);
        const cached = queryCache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
          console.log('[queryRAG] Returning cached result');
          return cached.result;
        }

        // Initialize Pinecone client
        console.log('[queryRAG] Initializing Pinecone client');
        const pineconeClient = new PineconeClient({
          indexName: process.env.PINECONE_INDEX_NAME || 'rag-agent-poc',
        });

        // Build filter from parameters
        const filter = buildPineconeFilter(params);
        console.log('[queryRAG] Built filter:', filter);

        // Always use userId as namespace for proper isolation
        const namespace = props.session?.user?.id;
        if (!namespace) {
          throw new Error('User session required for RAG queries');
        }
        console.log('[queryRAG] Using namespace:', namespace);

        // Internal configuration (not exposed to LLM)
        const topK = 10; // Fixed number of results to return
        const useReranking = true; // Always use reranking for better quality
        const expandContext = false; // Don't expand by default (can be slow)

        // Query Pinecone with text (integrated embeddings handle conversion)
        console.log('[queryRAG] Querying Pinecone with:', {
          query: params.query,
          namespace,
          topK: topK * 2, // Get more for reranking
          filter,
        });

        const queryResult: QueryResult = await pineconeClient.queryByText(
          params.query,
          {
            namespace,
            topK: topK * 2, // Get more results for reranking
            filter,
            includeMetadata: true,
            minScore: 0.0, // Temporarily lowered to debug - was filtering everything out
          },
        );

        console.log(
          '[queryRAG] Query returned',
          queryResult.matches.length,
          'matches',
        );

        let matches = queryResult.matches;

        // Apply reranking if enabled and we have results
        if (useReranking && matches.length > 0) {
          console.log('[queryRAG] Starting reranking process');

          // Store original positions for comparison
          const originalPositions = new Map(
            matches.map((m, idx) => [m.id, idx + 1]),
          );

          const reranker = createReranker();

          // Truncate content to avoid token limit (roughly 4 chars per token)
          // Keep it under 800 tokens to leave room for the query
          const truncatedMatches = matches.map((match) => ({
            ...match,
            content: match.content.substring(0, 3000), // ~750 tokens
          }));

          const rerankedResults = await reranker.rerank(
            params.query,
            truncatedMatches,
            {
              model: 'bge-reranker-v2-m3',
              topN: topK,
              returnDocuments: true,
            },
          );

          // Log reranking comparison
          console.log('[queryRAG] Reranking Results Comparison:');
          console.log('─'.repeat(100));
          console.log(
            '| New Pos | Old Pos | Change | RAG Score | Rerank Score | Doc ID',
          );
          console.log('─'.repeat(100));

          // Convert reranked results back to QueryMatch format
          // Restore original full content from the original matches
          const originalMatchesMap = new Map(matches.map((m) => [m.id, m]));
          matches = rerankedResults.map((result, newIdx) => {
            const originalMatch = originalMatchesMap.get(result.id);
            const oldPos = originalPositions.get(result.id) || 0;
            const newPos = newIdx + 1;
            const change = oldPos - newPos;
            const changeSymbol =
              change > 0
                ? `↑${change}`
                : change < 0
                  ? `↓${Math.abs(change)}`
                  : '─';

            console.log(
              `| ${String(newPos).padEnd(7)} | ${String(oldPos).padEnd(7)} | ${changeSymbol.padEnd(6)} | ${(
                originalMatch?.score || 0
              )
                .toFixed(3)
                .padEnd(
                  9,
                )} | ${result.score.toFixed(3).padEnd(12)} | ${result.id}`,
            );

            return {
              id: result.id,
              score: result.score,
              content: originalMatch?.content || result.content, // Use original full content
              metadata: result.metadata as RAGMetadata,
            };
          });
          console.log('─'.repeat(100));
          console.log(
            `[queryRAG] Reranking complete: ${rerankedResults.length} results reordered`,
          );
        } else {
          // Just take the top K without reranking
          matches = matches.slice(0, topK);
        }

        // Expand context if requested
        if (expandContext && matches.length > 0) {
          console.log(
            '[queryRAG] Expanding context for',
            matches.length,
            'matches',
          );
          matches = await expandChunkContext(
            matches,
            pineconeClient,
            namespace,
          );
        }

        // Format results for LLM
        const formattedContent = formatResultsForLLM(matches);

        const duration = Date.now() - startTime;

        const result = {
          success: true,
          query: params.query,
          matchCount: matches.length,
          namespace,
          duration: `${duration}ms`,
          content: formattedContent,
          matches: matches.map((m) => ({
            id: m.id,
            score: m.score,
            content: m.content, // Full content, let UI handle truncation
            metadata: m.metadata,
          })),
        };

        // Cache the result
        queryCache.set(cacheKey, { result, timestamp: Date.now() });

        return result;
      } catch (error) {
        console.error('[queryRAG] Error during execution:', error);
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';

        return {
          success: false,
          error: errorMessage,
          query: params.query,
          details: error instanceof Error ? error.stack : undefined,
        };
      }
    },
  });
};
