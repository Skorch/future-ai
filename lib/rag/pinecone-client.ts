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

        // For integrated embeddings, we pass text content directly
        // The 'content' field is mapped to text embedding via fieldMap configuration
        const records = batch.map((doc) => ({
          id: doc.id,
          metadata: {
            ...doc.metadata,
            content: doc.content, // This field is mapped for embedding generation
          } as RecordMetadata,
        }));

        try {
          await index.namespace(namespace).upsert(records);
          written += records.length;

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

      const response = await index.namespace(namespace).query({
        vector: queryVector,
        topK,
        filter,
        includeMetadata,
      });

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
      const vector = 'values' in embedding ? embedding.values : embedding.data;
      
      const response = await index.namespace(namespace).query({
        vector: vector as number[],
        topK,
        filter,
        includeMetadata,
      });

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
