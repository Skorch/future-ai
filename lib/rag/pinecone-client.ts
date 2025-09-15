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

/**
 * Wrapper for Pinecone vector database operations
 * Handles document storage, retrieval, and namespace management
 */
export class PineconeClient {
  private client: Pinecone;
  private indexName: string;

  constructor(config?: Partial<PineconeConfig>) {
    const apiKey = config?.apiKey || process.env.PINECONE_API_KEY;
    if (!apiKey) {
      throw new PineconeError('Pinecone API key is required');
    }

    this.client = new Pinecone({ apiKey });

    this.indexName =
      config?.indexName || process.env.PINECONE_INDEX_NAME || 'rag-index';
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
          // For integrated embeddings with Pinecone's data plane API
          // The field configured in fieldMap (content) will be auto-embedded
          // Check if we have the upsertRecords method (newer SDK) or need to use upsert
          const ns = index.namespace(namespace);

          if (
            'upsertRecords' in ns &&
            typeof (ns as unknown as { upsertRecords?: unknown })
              .upsertRecords === 'function'
          ) {
            // Use newer upsertRecords API for integrated embeddings
            const records = batch.map((doc) => ({
              _id: doc.id,
              content: doc.content, // This matches our fieldMap configuration
              ...doc.metadata, // Spread metadata as top-level fields
            }));
            await (
              ns as unknown as {
                upsertRecords: (records: unknown[]) => Promise<void>;
              }
            ).upsertRecords(records);
          } else {
            // Fallback to standard upsert with pre-computed embeddings
            // Generate embeddings using Pinecone's inference API
            const texts = batch.map((doc) => doc.content);
            const embedResponse = await this.client.inference.embed(
              'llama-text-embed-v2',
              texts,
              { inputType: 'passage' },
            );

            const records = batch.map((doc, idx) => {
              const embedding = embedResponse.data[idx];
              const vector =
                'values' in embedding
                  ? embedding.values
                  : (embedding as { data?: number[] }).data || [];

              return {
                id: doc.id,
                values: vector as number[],
                metadata: {
                  ...doc.metadata,
                  content: doc.content,
                } as RecordMetadata,
              };
            });

            await ns.upsert(records);
          }

          written += batch.length;

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
          errors.push(`Batch ${i / batchSize + 1}: ${message}`);
        }
      }

      return {
        success: errors.length === 0,
        documentsWritten: written,
        namespace,
        errors: errors.length > 0 ? errors : undefined,
      };
    } catch (error) {
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
            source: (match.metadata?.source as string) || '',
            type:
              (match.metadata?.type as 'transcript' | 'document' | 'chat') ||
              'document',
            topic: match.metadata?.topic as string | undefined,
            speakers: match.metadata?.speakers as string[] | undefined,
            startTime: match.metadata?.startTime as number | undefined,
            endTime: match.metadata?.endTime as number | undefined,
            chunkIndex: match.metadata?.chunkIndex as number | undefined,
            totalChunks: match.metadata?.totalChunks as number | undefined,
            createdAt:
              (match.metadata?.createdAt as string) || new Date().toISOString(),
            fileHash: match.metadata?.fileHash as string | undefined,
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

    try {
      const index = this.client.index(this.indexName);

      // For indexes with integrated embeddings, we need to use the inference API
      // to generate embeddings first
      const embedResponse = await this.client.inference.embed(
        'llama-text-embed-v2',
        [text],
        { inputType: 'query' },
      );

      const embedding = embedResponse.data[0];
      const vector =
        'values' in embedding
          ? embedding.values
          : (embedding as { data?: number[] }).data;

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

      const response = await index.namespace(namespace).query(queryParams);

      // Convert Pinecone matches to our format
      const matches: QueryMatch[] = (response.matches || [])
        .filter((match) => (match.score || 0) >= minScore)
        .map((match) => ({
          id: match.id,
          score: match.score || 0,
          content: (match.metadata?.content as string) || '',
          metadata: {
            source: (match.metadata?.source as string) || '',
            type:
              (match.metadata?.type as 'transcript' | 'document' | 'chat') ||
              'document',
            topic: match.metadata?.topic as string | undefined,
            speakers: match.metadata?.speakers as string[] | undefined,
            startTime: match.metadata?.startTime as number | undefined,
            endTime: match.metadata?.endTime as number | undefined,
            chunkIndex: match.metadata?.chunkIndex as number | undefined,
            totalChunks: match.metadata?.totalChunks as number | undefined,
            createdAt:
              (match.metadata?.createdAt as string) || new Date().toISOString(),
            fileHash: match.metadata?.fileHash as string | undefined,
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
    filter: Record<string, any>,
    namespace: string = DEFAULT_NAMESPACE
  ): Promise<void> {
    try {
      const index = this.client.index(this.indexName);

      // Query to find IDs matching the filter
      const queryResponse = await index.namespace(namespace).query({
        filter,
        topK: 10000, // Max vectors to delete in one operation
        includeValues: false,
        includeMetadata: false,
        vector: new Array(1536).fill(0), // Dummy vector for query
      });

      if (queryResponse.matches && queryResponse.matches.length > 0) {
        const idsToDelete = queryResponse.matches.map(match => match.id);

        // Delete the vectors
        await index.namespace(namespace).deleteMany(idsToDelete);

        console.log(`[Pinecone] Deleted ${idsToDelete.length} vectors with filter:`, filter);
      } else {
        console.log('[Pinecone] No vectors found to delete with filter:', filter);
      }
    } catch (error) {
      console.error('[Pinecone] Delete by metadata failed:', error);
      throw new PineconeError(
        `Delete by metadata failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error
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
