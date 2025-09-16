import { VoyageAIClient } from 'voyageai';
import type { QueryMatch } from './types';

/**
 * Reranking configuration options
 */
export interface RerankOptions {
  model?: 'rerank-2' | 'rerank-2-lite' | 'rerank-2.5' | 'rerank-2.5-lite';
  topN?: number;
  returnDocuments?: boolean;
  truncation?: boolean;
  scoreThreshold?: number;
}

/**
 * Reranked document result
 */
export interface RerankResult {
  id: string;
  score: number;
  content: string;
  metadata?: unknown;
}

/**
 * Reranker utility for improving search result relevance
 * Using Voyage AI for superior multilingual reranking
 */
export class Reranker {
  private voyage: VoyageAIClient;

  constructor(apiKey?: string) {
    const key = apiKey || process.env.VOYAGE_API_KEY;
    if (!key) {
      throw new Error('Voyage API key is required for reranking');
    }
    this.voyage = new VoyageAIClient({ apiKey: key });
  }

  /**
   * Rerank search results using Voyage AI's reranking API
   *
   * @param query - The original search query
   * @param documents - Array of documents to rerank (from vector search)
   * @param options - Reranking configuration
   * @returns Reranked documents sorted by relevance
   */
  async rerank(
    query: string,
    documents: QueryMatch[],
    options: RerankOptions = {},
  ): Promise<RerankResult[]> {
    const {
      model = 'rerank-2',
      topN = Math.min(documents.length, 10),
      returnDocuments = true,
      truncation = true,
      scoreThreshold = 0.5,
    } = options;

    if (documents.length === 0) {
      return [];
    }

    try {
      // Prepare documents for reranking
      const documentTexts = documents.map((doc) => doc.content);

      // Call Voyage reranking API
      const response = await this.voyage.rerank({
        query,
        documents: documentTexts,
        model,
        topK: topN,
        returnDocuments,
        truncation,
      });

      // Map reranked results back to original documents and filter by score threshold
      const results = (response.data || [])
        .map((result) => {
          const originalDoc = documents[result.index || 0];
          const score = result.relevanceScore || 0;

          return {
            id: originalDoc.id,
            score,
            content:
              returnDocuments && result.document
                ? result.document
                : originalDoc.content,
            metadata: originalDoc.metadata,
          };
        })
        .filter((result) => result.score >= scoreThreshold);

      console.log(
        `[Voyage Rerank] Filtered ${response.data?.length || 0} results to ${results.length} with score >= ${scoreThreshold}`,
      );

      return results;
    } catch (error) {
      console.error('Voyage reranking failed:', error);
      // Fallback: return original documents sorted by their vector scores
      return documents
        .slice(0, topN)
        .filter((doc) => doc.score >= scoreThreshold)
        .map((doc) => ({
          id: doc.id,
          score: doc.score,
          content: doc.content,
          metadata: doc.metadata,
        }));
    }
  }

  /**
   * Batch rerank multiple query-document sets
   * Useful for processing multiple queries efficiently
   */
  async batchRerank(
    queries: Array<{
      query: string;
      documents: QueryMatch[];
    }>,
    options: RerankOptions = {},
  ): Promise<RerankResult[][]> {
    const results = await Promise.all(
      queries.map(({ query, documents }) =>
        this.rerank(query, documents, options),
      ),
    );
    return results;
  }

  /**
   * Get available reranking models
   */
  getAvailableModels(): string[] {
    return ['rerank-2', 'rerank-2-lite', 'rerank-2.5', 'rerank-2.5-lite'];
  }
}

/**
 * Factory function for creating a reranker instance
 */
export function createReranker(apiKey?: string): Reranker {
  return new Reranker(apiKey);
}
