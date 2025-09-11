import { Pinecone } from '@pinecone-database/pinecone';
import type { QueryMatch } from './types';

/**
 * Reranking configuration options
 */
export interface RerankOptions {
  model?: 'cohere-rerank-3.5' | 'pinecone-rerank-v0';
  topN?: number;
  returnDocuments?: boolean;
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
 * Decoupled from PineconeClient for independent testing and swapping
 */
export class Reranker {
  private pinecone: Pinecone;

  constructor(apiKey?: string) {
    const key = apiKey || process.env.PINECONE_API_KEY;
    if (!key) {
      throw new Error('Pinecone API key is required for reranking');
    }
    this.pinecone = new Pinecone({ apiKey: key });
  }

  /**
   * Rerank search results using Pinecone's inference API
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
      model = 'cohere-rerank-3.5',
      topN = Math.min(documents.length, 10),
      returnDocuments = true,
    } = options;

    if (documents.length === 0) {
      return [];
    }

    try {
      // Prepare documents for reranking
      const documentTexts = documents.map((doc) => doc.content);

      // Call Pinecone inference API for reranking
      const response = await this.pinecone.inference.rerank(
        model,
        query,
        documentTexts,
        {
          topN,
          returnDocuments,
        },
      );

      // Map reranked results back to original documents
      return (
        response.data as Array<{
          index: number;
          score: number;
          document?: { text: string };
        }>
      ).map((result) => {
        // Find the original document by matching content
        const originalDoc = documents[result.index];

        return {
          id: originalDoc.id,
          score: result.score,
          content:
            returnDocuments && result.document
              ? result.document.text
              : originalDoc.content,
          metadata: originalDoc.metadata,
        };
      });
    } catch (error) {
      console.error('Reranking failed:', error);
      // Fallback: return original documents sorted by their vector scores
      return documents.slice(0, topN).map((doc) => ({
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
    return ['cohere-rerank-3.5', 'pinecone-rerank-v0'];
  }
}

/**
 * Factory function for creating a reranker instance
 */
export function createReranker(apiKey?: string): Reranker {
  return new Reranker(apiKey);
}
