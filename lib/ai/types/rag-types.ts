import { z } from 'zod';

// Core transcript types
export interface TranscriptItem {
  timecode: number; // seconds from start
  speaker: string;
  text: string;
}

export interface ChunkResult {
  topic: string;
  startIdx: number;
  endIdx: number;
  content: string;
  metadata: {
    startTime: number;
    endTime: number;
    speakers: string[];
  };
}

export interface ChunkOptions {
  chunkSize?: number;
  model?: string;
  dryRun?: boolean;
}

// RAG document types for vector storage
export interface RAGDocument {
  id: string;
  content: string;
  metadata: RAGMetadata;
  embedding?: number[];
  namespace?: string;
}

export interface RAGMetadata {
  source: string;
  type: 'transcript' | 'document' | 'chat';
  topic?: string;
  speakers?: string[];
  startTime?: number;
  endTime?: number;
  chunkIndex?: number;
  totalChunks?: number;
  createdAt: string;
  fileHash?: string;
}

// Write operation types
export interface WriteOptions {
  namespace?: string;
  batchSize?: number;
  generateEmbeddings?: boolean;
  progressCallback?: (progress: number) => void;
}

export interface WriteResult {
  success: boolean;
  documentsWritten: number;
  errors?: string[];
  namespace: string;
}

// Query operation types
export interface QueryOptions {
  namespace?: string;
  topK?: number;
  filter?: Record<string, unknown>;
  includeMetadata?: boolean;
  minScore?: number;
}

export interface QueryResult {
  matches: QueryMatch[];
  namespace: string;
}

export interface QueryMatch {
  id: string;
  score: number;
  content: string;
  metadata: RAGMetadata;
}

// Zod schemas for validation
export const transcriptItemSchema = z.object({
  timecode: z.number().min(0),
  speaker: z.string().min(1),
  text: z.string().min(1),
});

export const chunkResultSchema = z.object({
  topic: z.string(),
  startIdx: z.number().min(0),
  endIdx: z.number().min(0),
  content: z.string(),
  metadata: z.object({
    startTime: z.number().min(0),
    endTime: z.number().min(0),
    speakers: z.array(z.string()),
  }),
});

export const chunkOptionsSchema = z.object({
  chunkSize: z.number().min(1).optional(),
  model: z.string().optional(),
  dryRun: z.boolean().optional(),
});

export const ragMetadataSchema = z.object({
  source: z.string(),
  type: z.enum(['transcript', 'document', 'chat']),
  topic: z.string().optional(),
  speakers: z.array(z.string()).optional(),
  startTime: z.number().optional(),
  endTime: z.number().optional(),
  chunkIndex: z.number().optional(),
  totalChunks: z.number().optional(),
  createdAt: z.string(),
  fileHash: z.string().optional(),
});

export const ragDocumentSchema = z.object({
  id: z.string(),
  content: z.string(),
  metadata: ragMetadataSchema,
  embedding: z.array(z.number()).optional(),
  namespace: z.string().optional(),
});

export const writeOptionsSchema = z.object({
  namespace: z.string().optional(),
  batchSize: z.number().min(1).max(100).optional(),
  generateEmbeddings: z.boolean().optional(),
  progressCallback: z.function().optional(),
});

export const queryOptionsSchema = z.object({
  namespace: z.string().optional(),
  topK: z.number().min(1).max(100).optional(),
  filter: z.record(z.any()).optional(),
  includeMetadata: z.boolean().optional(),
  minScore: z.number().min(0).max(1).optional(),
});

// Type guards
export function isTranscriptItem(item: unknown): item is TranscriptItem {
  return transcriptItemSchema.safeParse(item).success;
}

export function isRAGDocument(doc: unknown): doc is RAGDocument {
  return ragDocumentSchema.safeParse(doc).success;
}

// Chunk schema for AI response parsing
export const chunkSchema = z.object({
  topic: z.string(),
  summary: z.string().optional(),
});
