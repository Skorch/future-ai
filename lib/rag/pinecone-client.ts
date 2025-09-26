import { Pinecone, type RecordMetadata } from '@pinecone-database/pinecone';
import type {
  RAGDocument,
  WriteOptions,
  WriteResult,
  QueryOptions,
  QueryResult,
  QueryMatch,
  PineconeConfig,
  PineconeIndexStats,
} from './types';
import {
  PineconeError,
  DEFAULT_NAMESPACE,
  DEFAULT_TOP_K,
  MAX_BATCH_SIZE,
  MIN_SCORE_THRESHOLD,
} from './types';
import { getVoyageAIClient, type VoyageAIClient } from './embeddings';
import { getLogger } from '@/lib/logger';

const logger = getLogger('PineconeClient');

/**
 * Wrapper for Pinecone vector database operations
 * Handles document storage, retrieval, and namespace management
 */
export class PineconeClient {
  private client: Pinecone;
  private indexName: string;
  private voyageClient: VoyageAIClient;

  constructor(config?: Partial<PineconeConfig>) {
    const apiKey = config?.apiKey || process.env.PINECONE_API_KEY;
    if (!apiKey) {
      throw new PineconeError('Pinecone API key is required');
    }

    this.client = new Pinecone({ apiKey });

    this.indexName =
      config?.indexName || process.env.PINECONE_INDEX_NAME || 'rag-index';

    // Initialize VoyageAI client for embeddings
    this.voyageClient = getVoyageAIClient();

    logger.debug('Client initialized with:', {
      indexName: this.indexName,
      hasApiKey: !!apiKey,
      apiKeyLength: apiKey.length,
      configSource: config?.indexName
        ? 'config'
        : process.env.PINECONE_INDEX_NAME
          ? 'env'
          : 'default',
      embeddingProvider: 'VoyageAI',
    });

    // Verify index exists (async, don't block constructor)
    this.verifyIndex().catch((err) => {
      logger.error('Index verification failed:', err);
    });
  }

  /**
   * Verify that the index exists and log its configuration
   */
  private async verifyIndex(): Promise<void> {
    try {
      const indexList = await this.client.listIndexes();
      const indexExists = indexList.indexes?.some(
        (idx) => idx.name === this.indexName,
      );

      if (!indexExists) {
        logger.error('WARNING: Index does not exist:', this.indexName);
        logger.error(
          'Available indexes:',
          indexList.indexes?.map((i) => i.name),
        );
        return;
      }

      const indexInfo = await this.client.describeIndex(this.indexName);
      logger.debug('Index verified:', {
        name: this.indexName,
        dimension: indexInfo.dimension,
        metric: indexInfo.metric,
        host: indexInfo.host,
        status: indexInfo.status,
      });
    } catch (error) {
      logger.error('Failed to verify index:', error);
    }
  }

  /**
   * Write documents to Pinecone in batches
   * For indexes with integrated embeddings, text content is automatically converted to vectors
   */
  async writeDocuments(
    documents: RAGDocument[],
    options: WriteOptions = {},
  ): Promise<WriteResult> {
    const {
      namespace = DEFAULT_NAMESPACE,
      batchSize = MAX_BATCH_SIZE,
      progressCallback,
    } = options;

    logger.info('writeDocuments called with:', {
      documentCount: documents.length,
      namespace,
      batchSize,
      indexName: this.indexName,
      firstDocId: documents[0]?.id,
    });

    if (documents.length === 0) {
      return {
        success: true,
        documentsWritten: 0,
        namespace,
      };
    }

    const errors: string[] = [];
    let written = 0;

    try {
      const index = this.client.index(this.indexName);

      // Process documents in batches
      for (let i = 0; i < documents.length; i += batchSize) {
        const batch = documents.slice(
          i,
          Math.min(i + batchSize, documents.length),
        );

        try {
          logger.debug(
            `Processing batch ${i / batchSize + 1}, size: ${batch.length}`,
          );

          // Always use VoyageAI for embeddings
          const ns = index.namespace(namespace);
          const texts = batch.map((doc) => doc.content);

          logger.debug(
            `Generating VoyageAI embeddings for ${texts.length} documents`,
          );
          // Text sample removed - contains document content

          // Use VoyageAI to generate embeddings
          const embeddings = await this.voyageClient.embedDocuments(texts);

          logger.debug('VoyageAI embeddings generated:', {
            count: embeddings.length,
            dimension: embeddings[0]?.length || 0,
          });

          // Create records with embeddings and metadata
          const records = batch.map((doc, idx) => ({
            id: doc.id,
            values: embeddings[idx],
            metadata: {
              ...doc.metadata,
              content: doc.content, // Store content in metadata for retrieval
            } as RecordMetadata,
          }));

          logger.debug(
            `Upserting ${records.length} records with VoyageAI embeddings to namespace: ${namespace}`,
          );
          await ns.upsert(records);

          written += batch.length;
          logger.debug(`Written so far: ${written}/${documents.length}`);

          // Report progress
          if (progressCallback) {
            const progress = Math.min(
              100,
              Math.round((written / documents.length) * 100),
            );
            progressCallback(progress);
          }
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'Unknown error';
          logger.error(`Batch ${i / batchSize + 1} failed:`, error);
          errors.push(`Batch ${i / batchSize + 1}: ${message}`);
        }
      }

      const result = {
        success: errors.length === 0,
        documentsWritten: written,
        namespace,
        errors: errors.length > 0 ? errors : undefined,
      };

      logger.debug('writeDocuments completed:', {
        success: result.success,
        documentsWritten: result.documentsWritten,
        namespace: result.namespace,
        errorCount: errors.length,
        errors: result.errors,
      });

      return result;
    } catch (error) {
      logger.error('writeDocuments failed with exception:', error);
      throw new PineconeError(
        `Failed to write documents: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error,
      );
    }
  }

  /**
   * Query vector database for similar documents
   */
  async query(
    queryVector: number[],
    options: QueryOptions = {},
  ): Promise<QueryResult> {
    const {
      namespace = DEFAULT_NAMESPACE,
      topK = DEFAULT_TOP_K,
      filter,
      includeMetadata = true,
      minScore = MIN_SCORE_THRESHOLD,
    } = options;

    try {
      const index = this.client.index(this.indexName);

      // Build query params, only include filter if it has keys
      const queryParams: {
        vector: number[];
        topK: number;
        includeMetadata: boolean;
        filter?: Record<string, unknown>;
      } = {
        vector: queryVector,
        topK,
        includeMetadata,
      };

      if (filter && Object.keys(filter).length > 0) {
        queryParams.filter = filter;
      }

      const response = await index.namespace(namespace).query(queryParams);

      // Convert Pinecone matches to our format
      const matches: QueryMatch[] = (response.matches || [])
        .filter((match) => (match.score || 0) >= minScore)
        .map((match) => ({
          id: match.id,
          score: match.score || 0,
          content: (match.metadata?.content as string) || '',
          metadata: {
            // Core identifiers (required by RAGMetadata)
            documentId: (match.metadata?.documentId as string) || match.id,
            documentType:
              (match.metadata?.documentType as string) || 'document',
            userId: (match.metadata?.userId as string) || '',

            // Document info (required)
            title: (match.metadata?.title as string) || '',
            kind: (match.metadata?.kind as string) || 'text',
            createdAt:
              (match.metadata?.createdAt as string) || new Date().toISOString(),

            // Chunk specifics (required)
            chunkIndex: (match.metadata?.chunkIndex as number) || 0,
            totalChunks: (match.metadata?.totalChunks as number) || 1,
            fileHash: (match.metadata?.fileHash as string) || '',
            contentSource:
              (match.metadata?.contentSource as
                | 'transcript'
                | 'artifact'
                | 'unknown') || 'unknown',

            // Optional fields
            topic: match.metadata?.topic as string | undefined,
            speakers: match.metadata?.speakers as string[] | undefined,
            startTime: match.metadata?.startTime as number | undefined,
            endTime: match.metadata?.endTime as number | undefined,

            // Legacy fields for backward compatibility
            source: (match.metadata?.source as string) || '',
            type:
              (match.metadata?.type as 'transcript' | 'document' | 'chat') ||
              'document',
          },
        }));

      return {
        matches,
        namespace,
      };
    } catch (error) {
      throw new PineconeError(
        `Query failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error,
      );
    }
  }

  /**
   * Query using text (for indexes with integrated embeddings)
   * The index automatically converts text to vectors
   */
  async queryByText(
    text: string,
    options: QueryOptions = {},
  ): Promise<QueryResult> {
    const {
      namespace = DEFAULT_NAMESPACE,
      topK = DEFAULT_TOP_K,
      filter,
      includeMetadata = true,
      minScore = MIN_SCORE_THRESHOLD,
    } = options;

    logger.debug('queryByText called with:', {
      // text removed - contains user search query
      namespace,
      topK,
      filter,
      minScore,
    });

    try {
      const index = this.client.index(this.indexName);

      // Use VoyageAI to generate query embedding
      logger.debug('Generating VoyageAI query embedding');
      const vector = await this.voyageClient.embedQuery(text);

      logger.debug(
        'VoyageAI query embedding generated, dimensions:',
        vector.length,
      );

      // Build query params, only include filter if it has keys
      const queryParams: {
        vector: number[];
        topK: number;
        includeMetadata: boolean;
        filter?: Record<string, unknown>;
      } = {
        vector: vector as number[],
        topK,
        includeMetadata,
      };

      if (filter && Object.keys(filter).length > 0) {
        queryParams.filter = filter;
      }

      logger.debug('Querying with params:', {
        namespace,
        topK: queryParams.topK,
        hasFilter: !!queryParams.filter,
        filterKeys: queryParams.filter ? Object.keys(queryParams.filter) : [],
      });

      const response = await index.namespace(namespace).query(queryParams);

      logger.debug('Query response:', {
        matchCount: response.matches?.length || 0,
        firstMatchScore: response.matches?.[0]?.score,
        namespace: response.namespace,
      });

      // Convert Pinecone matches to our format
      const matches: QueryMatch[] = (response.matches || [])
        .filter((match) => (match.score || 0) >= minScore)
        .map((match) => ({
          id: match.id,
          score: match.score || 0,
          content: (match.metadata?.content as string) || '',
          metadata: {
            // Core identifiers (required by RAGMetadata)
            documentId: (match.metadata?.documentId as string) || match.id,
            documentType:
              (match.metadata?.documentType as string) || 'document',
            userId: (match.metadata?.userId as string) || '',

            // Document info (required)
            title: (match.metadata?.title as string) || '',
            kind: (match.metadata?.kind as string) || 'text',
            createdAt:
              (match.metadata?.createdAt as string) || new Date().toISOString(),

            // Chunk specifics (required)
            chunkIndex: (match.metadata?.chunkIndex as number) || 0,
            totalChunks: (match.metadata?.totalChunks as number) || 1,
            fileHash: (match.metadata?.fileHash as string) || '',
            contentSource:
              (match.metadata?.contentSource as
                | 'transcript'
                | 'artifact'
                | 'unknown') || 'unknown',

            // Optional fields
            topic: match.metadata?.topic as string | undefined,
            speakers: match.metadata?.speakers as string[] | undefined,
            startTime: match.metadata?.startTime as number | undefined,
            endTime: match.metadata?.endTime as number | undefined,

            // Legacy fields for backward compatibility
            source: (match.metadata?.source as string) || '',
            type:
              (match.metadata?.type as 'transcript' | 'document' | 'chat') ||
              'document',
          },
        }));

      return {
        matches,
        namespace,
      };
    } catch (error) {
      throw new PineconeError(
        `Text query failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error,
      );
    }
  }

  /**
   * Delete all vectors in a namespace
   */
  async deleteNamespace(namespace: string = DEFAULT_NAMESPACE): Promise<void> {
    try {
      const index = this.client.index(this.indexName);
      await index.namespace(namespace).deleteAll();
    } catch (error) {
      throw new PineconeError(
        `Failed to delete namespace ${namespace}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error,
      );
    }
  }

  /**
   * Delete specific documents by ID
   */
  async deleteDocuments(
    ids: string[],
    namespace: string = DEFAULT_NAMESPACE,
  ): Promise<void> {
    if (ids.length === 0) return;

    try {
      const index = this.client.index(this.indexName);
      await index.namespace(namespace).deleteMany(ids);
    } catch (error) {
      throw new PineconeError(
        `Failed to delete documents: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error,
      );
    }
  }

  /**
   * Delete vectors by metadata filter
   * Used for UPSERT pattern when updating documents
   */
  async deleteByMetadata(
    filter: Record<string, unknown>,
    namespace: string = DEFAULT_NAMESPACE,
  ): Promise<void> {
    try {
      const index = this.client.index(this.indexName);

      // Use deleteMany with the filter directly (not wrapped)
      // The filter should use MongoDB-style operators like $eq
      await index.namespace(namespace).deleteMany(filter);

      logger.debug(
        'Deleted vectors with filter:',
        filter,
        'in namespace:',
        namespace,
      );
    } catch (error) {
      // Check if it's a 404 error (namespace doesn't exist) - this is OK
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('404') || errorMessage.includes('not found')) {
        logger.debug('Namespace does not exist (OK to ignore):', namespace);
        return;
      }

      // For other errors, log and throw
      logger.error('Delete by metadata failed:', error);
      throw new PineconeError(
        `Delete by metadata failed: ${errorMessage}`,
        error,
      );
    }
  }

  /**
   * Get index statistics
   */
  async getStats(): Promise<PineconeIndexStats> {
    try {
      const index = this.client.index(this.indexName);
      const stats = await index.describeIndexStats();

      return {
        dimension: stats.dimension || 0,
        indexFullness: stats.indexFullness || 0,
        totalVectorCount: stats.totalRecordCount || 0,
        namespaces: stats.namespaces
          ? Object.fromEntries(
              Object.entries(stats.namespaces).map(([name, ns]) => [
                name,
                { vectorCount: ns.recordCount || 0 },
              ]),
            )
          : undefined,
      };
    } catch (error) {
      throw new PineconeError(
        `Failed to get index stats: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error,
      );
    }
  }

  /**
   * Check if index exists
   */
  async indexExists(): Promise<boolean> {
    try {
      const indexes = await this.client.listIndexes();
      return (
        indexes.indexes?.some((idx) => idx.name === this.indexName) || false
      );
    } catch (error) {
      throw new PineconeError(
        `Failed to check index existence: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error,
      );
    }
  }

  /**
   * Create index if it doesn't exist
   */
  async createIndexIfNotExists(dimension = 1536): Promise<void> {
    try {
      const exists = await this.indexExists();
      if (!exists) {
        await this.client.createIndex({
          name: this.indexName,
          dimension,
          metric: 'cosine',
          spec: {
            serverless: {
              cloud: 'aws',
              region: 'us-east-1',
            },
          },
        });

        // Wait for index to be ready
        await this.waitForIndexReady();
      }
    } catch (error) {
      throw new PineconeError(
        `Failed to create index: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error,
      );
    }
  }

  /**
   * Wait for index to be ready
   */
  private async waitForIndexReady(maxRetries = 30): Promise<void> {
    for (let i = 0; i < maxRetries; i++) {
      try {
        const description = await this.client.describeIndex(this.indexName);
        if (description.status?.ready) {
          return;
        }
      } catch {
        // Index might not exist yet
      }

      // Wait 2 seconds before retry
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    throw new PineconeError('Index failed to become ready within timeout');
  }
}
