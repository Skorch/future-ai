import { getLogger } from '@/lib/logger';

const logger = getLogger('QueryRAG');
import { tool, type UIMessageStreamWriter } from 'ai';
import { z } from 'zod';
import { PineconeClient } from '../../rag/pinecone-client';
import { createReranker } from '../../rag/reranker';
import { rerankWithLLM, type LLMRerankResult } from '../../rag/llm-reranker';
import type { QueryResult, QueryMatch, RAGMetadata } from '../../rag/types';
import type { ChatMessage } from '@/lib/types';
import { QUERY_RAG_PROMPT } from '@/lib/ai/prompts/tools/query-rag';
import { documentTypes, getDocumentTypeDisplayMap } from '@/lib/artifacts';

// Build dynamic content types: registry types + special metadata filters
// Note: 'transcript' and 'document' are metadata filters, not registry types
const contentTypesArray: string[] = [
  ...documentTypes,
  'transcript',
  'document',
  'all',
];
const contentTypes = contentTypesArray as [string, ...string[]];

// Tool parameter schema - only expose what LLM needs to control
const queryRAGSchema = z.object({
  query: z.string().describe('Search query to find relevant content'),
  contentType: z
    .enum(contentTypes)
    .optional()
    .default('all')
    .describe(
      `Filter results by content type. Available types: ${contentTypes.join(', ')}. (transcript for raw transcripts, meeting-analysis for AI-generated summaries, document for other text)`,
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
  rerankMethod: z
    .enum(['llm', 'voyage'])
    .optional()
    .default('voyage')
    .describe('Reranking method: llm (Claude Haiku) or voyage (Voyage AI)'),
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
        logger.error('Failed to fetch adjacent chunks:', error);
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
  session: { user: { id: string } };
  dataStream: UIMessageStreamWriter<ChatMessage>;
  workspaceId: string;
}

export const queryRAG = (props: QueryRAGProps) => {
  const { session, dataStream, workspaceId } = props;
  logger.debug(
    '[queryRAG] Creating tool with session user:',
    props.session?.user?.id,
  );

  return tool({
    description: QUERY_RAG_PROMPT,
    inputSchema: queryRAGSchema,
    execute: async (params) => {
      const startTime = Date.now();

      // Get display name mapping for document types
      const displayMap = await getDocumentTypeDisplayMap();

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

        // Use workspaceId as namespace for proper isolation
        const namespace = workspaceId;
        if (!namespace) {
          throw new Error('Workspace context required for RAG queries');
        }

        // Internal configuration (not exposed to LLM)
        const topK = 50; // Number of results to return after reranking (filtered by 33% relevance threshold)
        const initialFetchK = 150; // Fetch more results for reranking (3x topK for better reranking)
        const useReranking = true; // Always use reranking for better quality
        const expandContext = false; // Don't expand by default (can be slow)

        // Query Pinecone with text (integrated embeddings handle conversion)

        const queryResult: QueryResult = await pineconeClient.queryByText(
          params.query,
          {
            namespace,
            topK: initialFetchK, // Fetch more results for reranking
            filter,
            includeMetadata: true,
            minScore: 0.0, // Temporarily lowered to debug - was filtering everything out
          },
        );

        let matches = queryResult.matches;
        let llmRerankResult: LLMRerankResult | null = null;

        // Apply reranking if enabled and we have results
        if (useReranking && matches.length > 0) {
          if (params.rerankMethod === 'llm') {
            // Use LLM reranker (default)
            try {
              llmRerankResult = await rerankWithLLM(params.query, matches, {
                maxMatches: topK,
              });

              // Use the LLM-reranked matches
              matches = llmRerankResult.matches.map((m) => ({
                id: m.id,
                score: m.score,
                content: m.content,
                metadata: m.metadata,
                // Add LLM-specific fields for UI
                ...(m.topicId && { topicId: m.topicId }),
                ...(m.merged && { merged: m.merged }),
              }));
            } catch (error) {
              logger.error(
                '[queryRAG] LLM reranking failed, falling back to Voyage',
              );
              // Fall back to Voyage on error
              params.rerankMethod = 'voyage';
            }
          }

          if (params.rerankMethod === 'voyage') {
            // Use Voyage reranker as fallback

            // Store original positions for comparison
            const originalPositions = new Map(
              matches.map((m, idx) => [m.id, idx + 1]),
            );

            const reranker = createReranker();

            // Truncate content for Voyage rerank-2 16K token window
            // Voyage rerank-2 supports 16K tokens combined (4K query + 12K per doc)
            // Using ~4 chars per token, we can use up to 48K chars per document
            // Being conservative with 40K to leave room for query
            const truncatedMatches = matches.map((match) => ({
              ...match,
              content: match.content.substring(0, 40000), // ~10K tokens per doc
            }));

            const rerankedResults = await reranker.rerank(
              params.query,
              truncatedMatches,
              {
                model: 'rerank-2.5',
                topN: topK,
                returnDocuments: true,
                truncation: true,
                scoreThreshold: 0.33, // Filter out results below 33% relevance
              },
            );

            // Convert reranked results back to QueryMatch format
            // Restore original full content from the original matches
            const originalMatchesMap = new Map(matches.map((m) => [m.id, m]));
            matches = rerankedResults.map((result) => {
              const originalMatch = originalMatchesMap.get(result.id);
              return {
                id: result.id,
                score: result.score,
                content: originalMatch?.content || result.content, // Use original full content
                metadata: result.metadata as RAGMetadata,
              };
            });
          }
        } else {
          // Just take the top K without reranking
          matches = matches.slice(0, topK);
        }

        // Expand context if requested
        if (expandContext && matches.length > 0) {
          matches = await expandChunkContext(
            matches,
            pineconeClient,
            namespace,
          );
        }

        // Format results for LLM
        const formattedContent =
          llmRerankResult?.content || formatResultsForLLM(matches);

        const duration = Date.now() - startTime;

        // Determine which rerank method was actually used
        const actualRerankMethod = llmRerankResult
          ? 'llm'
          : params.rerankMethod === 'voyage'
            ? 'voyage'
            : 'none';

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
            metadata: {
              ...m.metadata,
              // Add display name for the document type
              documentTypeDisplay:
                displayMap[m.metadata.documentType] ||
                m.metadata.documentType.charAt(0).toUpperCase() +
                  m.metadata.documentType.slice(1).replace(/-/g, ' '),
            },
            // IMPORTANT: Preserve LLM-specific fields for UI topic grouping
            ...(m.topicId && { topicId: m.topicId }),
            ...(m.merged && { merged: m.merged }),
          })),
          // DETERMINISTIC: Embed rerank info in a metadata object that AI SDK will preserve
          metadata: {
            rerankMethod: actualRerankMethod,
            ...(llmRerankResult && {
              topicGroups: llmRerankResult.topicGroups,
              topicCount: llmRerankResult.topicGroups.length,
            }),
          },
          // Also keep at top level for backward compatibility
          ...(llmRerankResult && {
            topicGroups: llmRerankResult.topicGroups,
            rerankMethod: 'llm' as const,
          }),
          ...(params.rerankMethod === 'voyage' &&
            !llmRerankResult && {
              rerankMethod: 'voyage' as const,
            }),
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
          details: error instanceof Error ? error.stack : undefined,
        };
      }
    },
  });
};
