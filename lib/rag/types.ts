// Central export point for all RAG types
export type {
  TranscriptItem,
  ChunkResult,
  ChunkOptions,
  RAGDocument,
  RAGMetadata,
  WriteOptions,
  WriteResult,
  QueryOptions,
  QueryResult,
  QueryMatch,
} from '../ai/types/rag-types';

export {
  // Schemas
  transcriptItemSchema,
  chunkResultSchema,
  chunkOptionsSchema,
  ragMetadataSchema,
  ragDocumentSchema,
  writeOptionsSchema,
  queryOptionsSchema,
  chunkSchema,
  // Type guards
  isTranscriptItem,
  isRAGDocument,
} from '../ai/types/rag-types';

// Pinecone-specific types
export interface PineconeConfig {
  apiKey: string;
  environment?: string;
  indexName: string;
  dimension?: number;
  metric?: 'cosine' | 'euclidean' | 'dotproduct';
}

export interface PineconeIndexStats {
  dimension: number;
  indexFullness: number;
  totalVectorCount: number;
  namespaces?: Record<string, { vectorCount: number }>;
}

// Error types
export class RAGError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'RAGError';
  }
}

export class PineconeError extends RAGError {
  constructor(message: string, details?: unknown) {
    super(message, 'PINECONE_ERROR', details);
    this.name = 'PineconeError';
  }
}

export class ParsingError extends RAGError {
  constructor(message: string, details?: unknown) {
    super(message, 'PARSING_ERROR', details);
    this.name = 'ParsingError';
  }
}

// Constants
export const DEFAULT_CHUNK_SIZE = 20;
export const DEFAULT_TOP_K = 10;
export const DEFAULT_NAMESPACE = 'default';
export const DEFAULT_DIMENSION = 1536; // OpenAI embedding dimension
export const MAX_BATCH_SIZE = 100;
export const MIN_SCORE_THRESHOLD = 0.0; // Set to 0 to see all results during debugging
