/**
 * VoyageAI Embeddings Service
 * Uses REST API directly as the SDK is not being maintained
 * Documentation: https://docs.voyageai.com/reference/embeddings-api
 *
 * Using voyage-3-large model for best quality embeddings
 * Max tokens: 120K total across all inputs
 * Max batch size: 1,000 texts
 */

import { getLogger } from '@/lib/logger';

const logger = getLogger('VoyageAI');

export class VoyageAIError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'VoyageAIError';
  }
}

export interface VoyageAIConfig {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  outputDimension?: number;
}

export interface EmbeddingOptions {
  inputType?: 'query' | 'document';
  truncation?: boolean;
  outputDimension?: number; // voyage-3-large supports: 2048, 1024 (default), 512, 256
  outputDtype?: 'float' | 'int8' | 'uint8' | 'binary' | 'ubinary';
}

export interface VoyageAIResponse {
  object: string;
  data: Array<{
    object: string;
    embedding: number[];
    index: number;
  }>;
  model: string;
  usage: {
    total_tokens: number;
  };
}

/**
 * VoyageAI client for generating embeddings
 */
export class VoyageAIClient {
  private apiKey: string;
  private baseUrl: string;
  private model: string;
  private defaultOutputDimension: number;

  constructor(config?: VoyageAIConfig) {
    this.apiKey = config?.apiKey || process.env.VOYAGE_API_KEY || '';
    if (!this.apiKey) {
      throw new VoyageAIError(
        'VoyageAI API key is required. Set VOYAGE_API_KEY environment variable.',
      );
    }

    this.baseUrl = config?.baseUrl || 'https://api.voyageai.com/v1';
    // Use voyage-3-large for best quality embeddings
    this.model = config?.model || 'voyage-3-large';
    // Default to 1024 dimensions (voyage-3-large default)
    this.defaultOutputDimension = config?.outputDimension || 1024;

    logger.debug('Client initialized:', {
      model: this.model,
      baseUrl: this.baseUrl,
      defaultOutputDimension: this.defaultOutputDimension,
    });
  }

  /**
   * Generate embeddings for documents (for indexing)
   * IMPORTANT: Uses input_type='document' for optimal retrieval performance
   */
  async embedDocuments(
    texts: string[],
    options?: EmbeddingOptions,
  ): Promise<number[][]> {
    if (texts.length === 0) {
      return [];
    }

    // Ensure we don't exceed the max batch size (1000 texts for voyage-3-large)
    if (texts.length > 1000) {
      logger.warn(
        `Batch size ${texts.length} exceeds max (1000), will need batching`,
      );
      return this.embedDocumentsBatch(texts, 1000, options);
    }

    logger.debug(`Generating embeddings for ${texts.length} documents`);

    try {
      // Always use input_type='document' for document embeddings
      const response = await this.embed(texts, {
        ...options,
        inputType: 'document', // Critical for RAG performance
      });

      // Sort by index to maintain order
      const sortedEmbeddings = response.data
        .sort((a, b) => a.index - b.index)
        .map((item) => item.embedding);

      logger.debug(
        `Successfully generated ${sortedEmbeddings.length} document embeddings`,
      );
      logger.debug(`Embedding dimension: ${sortedEmbeddings[0]?.length || 0}`);
      logger.debug(
        `Total tokens used: ${response.usage?.total_tokens || 'unknown'}`,
      );

      return sortedEmbeddings;
    } catch (error) {
      logger.error('Failed to generate document embeddings:', error);
      throw error;
    }
  }

  /**
   * Generate embedding for a query (for searching)
   * IMPORTANT: Uses input_type='query' for optimal retrieval performance
   */
  async embedQuery(
    text: string,
    options?: EmbeddingOptions,
  ): Promise<number[]> {
    logger.debug('Generating query embedding');
    // Query preview removed - contains user search terms

    try {
      // Always use input_type='query' for search queries
      const response = await this.embed(text, {
        ...options,
        inputType: 'query', // Critical for RAG performance
      });

      const embedding = response.data[0]?.embedding;
      if (!embedding) {
        throw new VoyageAIError('No embedding returned for query');
      }

      logger.debug(`Query embedding generated, dimension: ${embedding.length}`);
      return embedding;
    } catch (error) {
      logger.error('Failed to generate query embedding:', error);
      throw error;
    }
  }

  /**
   * Core embed method that calls the VoyageAI REST API
   * Conforms to: https://docs.voyageai.com/reference/embeddings-api
   */
  private async embed(
    input: string | string[],
    options: EmbeddingOptions = {},
  ): Promise<VoyageAIResponse> {
    const {
      inputType,
      truncation = true,
      outputDimension = this.defaultOutputDimension,
      outputDtype = 'float',
    } = options;

    // Build request body according to API spec
    const requestBody: Record<string, string | boolean | number | string[]> = {
      input,
      model: this.model,
      truncation,
    };

    // Only include optional parameters if specified
    if (inputType) {
      requestBody.input_type = inputType;
    }

    if (outputDimension !== 1024) {
      // Only include if not default
      requestBody.output_dimension = outputDimension;
    }

    if (outputDtype !== 'float') {
      // Only include if not default
      requestBody.output_dtype = outputDtype;
    }

    logger.debug('Sending request to API:', {
      model: this.model,
      inputCount: Array.isArray(input) ? input.length : 1,
      inputType: inputType || 'not specified',
      truncation,
      outputDimension,
      outputDtype,
      // firstInputLength removed - may contain document content length info
    });

    try {
      const response = await fetch(`${this.baseUrl}/embeddings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorDetails: unknown;
        try {
          errorDetails = JSON.parse(errorText);
        } catch {
          errorDetails = errorText;
        }

        logger.error('API error response:', {
          status: response.status,
          statusText: response.statusText,
          details: errorDetails,
        });

        throw new VoyageAIError(
          `VoyageAI API error: ${response.statusText}`,
          response.status,
          errorDetails,
        );
      }

      const data: VoyageAIResponse = await response.json();

      logger.debug('API response:', {
        model: data.model,
        embeddingCount: data.data?.length,
        totalTokens: data.usage?.total_tokens,
      });

      return data;
    } catch (error) {
      if (error instanceof VoyageAIError) {
        throw error;
      }

      logger.error('Network or parsing error:', error);
      throw new VoyageAIError(
        `Failed to call VoyageAI API: ${error instanceof Error ? error.message : 'Unknown error'}`,
        undefined,
        error,
      );
    }
  }

  /**
   * Batch embed documents with automatic chunking for large batches
   * voyage-3-large limits: max 1000 texts, max 120K total tokens
   */
  async embedDocumentsBatch(
    texts: string[],
    batchSize = 100, // Conservative default for voyage-3-large
    options?: EmbeddingOptions,
  ): Promise<number[][]> {
    if (texts.length === 0) {
      return [];
    }

    // Ensure batch size doesn't exceed API limits
    let effectiveBatchSize = Math.min(batchSize, 1000);

    if (texts.length <= effectiveBatchSize) {
      // Try to process all at once if within limits
      try {
        return await this.embedDocuments(texts, options);
      } catch (error) {
        // If we hit token limit, fall back to smaller batches
        const err = error as { message?: string; statusCode?: number };
        if (err?.message?.includes('token') || err?.statusCode === 400) {
          logger.warn('Hit token limit, reducing batch size');
          effectiveBatchSize = Math.max(10, Math.floor(effectiveBatchSize / 2));
        } else {
          throw error;
        }
      }
    }

    logger.debug(
      `Batch embedding ${texts.length} documents in batches of ${effectiveBatchSize}`,
    );

    const allEmbeddings: number[][] = [];

    for (let i = 0; i < texts.length; i += effectiveBatchSize) {
      const batch = texts.slice(
        i,
        Math.min(i + effectiveBatchSize, texts.length),
      );
      const batchNum = Math.floor(i / effectiveBatchSize) + 1;
      const totalBatches = Math.ceil(texts.length / effectiveBatchSize);

      logger.debug(
        `Processing batch ${batchNum}/${totalBatches} (${batch.length} texts)`,
      );

      try {
        // Don't call embedDocuments recursively to avoid the batch check
        const response = await this.embed(batch, {
          ...options,
          inputType: 'document',
        });

        const sortedEmbeddings = response.data
          .sort((a, b) => a.index - b.index)
          .map((item) => item.embedding);

        allEmbeddings.push(...sortedEmbeddings);

        logger.debug(
          `Batch ${batchNum} complete, tokens used: ${response.usage?.total_tokens || 'unknown'}`,
        );
      } catch (error) {
        logger.error(`Batch ${batchNum} failed:`, error);
        throw error;
      }

      // Small delay between batches to avoid rate limiting
      if (i + effectiveBatchSize < texts.length) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    logger.debug(
      `Batch embedding complete: ${allEmbeddings.length} embeddings generated`,
    );
    return allEmbeddings;
  }
}

// Singleton instance for reuse
let voyageClient: VoyageAIClient | null = null;

/**
 * Get or create a VoyageAI client instance
 */
export function getVoyageAIClient(config?: VoyageAIConfig): VoyageAIClient {
  if (!voyageClient) {
    voyageClient = new VoyageAIClient(config);
  }
  return voyageClient;
}
