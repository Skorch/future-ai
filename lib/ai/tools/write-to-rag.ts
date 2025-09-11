import { tool, type UIMessageStreamWriter } from 'ai';
import { z } from 'zod';
import crypto from 'node:crypto';
import { PineconeClient } from '../../rag/pinecone-client';
import { parseTranscript, parseDocument } from '../utils/transcript-parser';
import { chunkTranscriptItems } from '../utils/rag-chunker';
import type {
  RAGDocument,
  TranscriptItem,
  ChunkResult,
  WriteResult,
} from '../../rag/types';
import type { Session } from 'next-auth';
import type { ChatMessage } from '@/lib/types';

// Tool parameter schema
const writeToRAGSchema = z.object({
  content: z.string().describe('Raw content to store in RAG system'),
  contentType: z
    .enum(['transcript', 'document', 'chat'])
    .describe('Type of content being stored'),
  format: z
    .enum(['webvtt', 'fathom', 'markdown', 'text'])
    .optional()
    .describe('Optional format hint for parsing'),
  source: z.string().describe('Source identifier (file path or URL)'),
  namespace: z
    .string()
    .optional()
    .default('default')
    .describe('Namespace for organizing content'),
  metadata: z
    .object({
      topics: z
        .array(z.string())
        .optional()
        .describe('Topics for transcript chunking guidance'),
      author: z.string().optional().describe('Author of the content'),
      sessionId: z
        .string()
        .optional()
        .describe('Session ID for grouping related content'),
    })
    .passthrough()
    .optional()
    .describe('Additional metadata to store with the content'),
});

type WriteToRAGParams = z.infer<typeof writeToRAGSchema>;

// Progress event types for streaming
type ProgressEvent =
  | { type: 'parsing'; message: string }
  | { type: 'chunking'; message: string; progress?: number }
  | { type: 'storing'; message: string; progress?: number }
  | { type: 'complete'; documentsWritten: number }
  | { type: 'error'; message: string };

/**
 * Process content based on type and convert to RAG documents
 */
async function processContent(
  params: WriteToRAGParams,
  onProgress?: (event: ProgressEvent) => void,
): Promise<RAGDocument[]> {
  const { content, contentType, format, source, metadata = {} } = params;
  const documents: RAGDocument[] = [];
  const fileHash = crypto.createHash('sha256').update(content).digest('hex');

  onProgress?.({
    type: 'parsing',
    message: `Parsing ${contentType} content...`,
  });

  switch (contentType) {
    case 'transcript': {
      // Parse transcript content
      let items: TranscriptItem[];
      try {
        items = parseTranscript(content);
      } catch (error) {
        // If auto-detection fails, try based on format hint
        if (format === 'webvtt' || format === 'fathom') {
          throw error;
        }
        // Fallback to document parsing for text/markdown
        items = parseDocument(content);
      }

      onProgress?.({
        type: 'chunking',
        message: 'Creating intelligent topic-based chunks...',
      });

      // Chunk transcript into topic-based segments
      const topics = metadata.topics || [];
      const chunks = await chunkTranscriptItems(items, topics, {
        model: 'claude-sonnet-4',
        dryRun: false,
      });

      // Convert chunks to RAG documents
      chunks.forEach((chunk: ChunkResult, index: number) => {
        documents.push({
          id: `${fileHash}-chunk-${index}`,
          content: chunk.content,
          metadata: {
            source,
            type: 'transcript',
            topic: chunk.topic,
            speakers: chunk.metadata.speakers,
            startTime: chunk.metadata.startTime,
            endTime: chunk.metadata.endTime,
            chunkIndex: index,
            totalChunks: chunks.length,
            createdAt: new Date().toISOString(),
            fileHash,
            ...metadata,
          },
        });

        const progress = Math.round(((index + 1) / chunks.length) * 100);
        onProgress?.({
          type: 'chunking',
          message: `Processing chunk ${index + 1}/${chunks.length}`,
          progress,
        });
      });
      break;
    }

    case 'document': {
      // Parse document content
      const sections = parseDocument(content);

      onProgress?.({
        type: 'chunking',
        message: 'Splitting document into sections...',
      });

      // Convert sections to RAG documents
      sections.forEach((section: TranscriptItem, index: number) => {
        documents.push({
          id: `${fileHash}-section-${index}`,
          content: section.text,
          metadata: {
            source,
            type: 'document',
            chunkIndex: index,
            totalChunks: sections.length,
            createdAt: new Date().toISOString(),
            fileHash,
            ...metadata,
          },
        });
      });
      break;
    }

    case 'chat': {
      // Store chat content as a single document
      documents.push({
        id: `${fileHash}-chat`,
        content,
        metadata: {
          source,
          type: 'chat',
          createdAt: new Date().toISOString(),
          fileHash,
          ...metadata,
        },
      });
      break;
    }
  }

  return documents;
}

/**
 * Write-to-RAG Tool
 * Processes and stores various content types in the vector database
 */
interface WriteToRAGProps {
  session: Session;
  dataStream: UIMessageStreamWriter<ChatMessage>;
}

export const writeToRAG = (_props: WriteToRAGProps) =>
  tool({
    description:
      'Store transcript, document, or chat content in the RAG system for later retrieval',
    inputSchema: writeToRAGSchema,
    execute: async (params) => {
      const startTime = Date.now();

      try {
        // Process content into RAG documents (progress tracking disabled for now)
        const documents = await processContent(params);

        if (documents.length === 0) {
          return {
            success: false,
            error: 'No content to store after processing',
          };
        }

        // Initialize Pinecone client
        const pineconeClient = new PineconeClient({
          indexName: process.env.PINECONE_INDEX_NAME || 'rag-agent-poc',
        });

        // Write documents to Pinecone
        const result: WriteResult = await pineconeClient.writeDocuments(
          documents,
          {
            namespace: params.namespace,
          },
        );

        const duration = Date.now() - startTime;

        return {
          success: result.success,
          documentsWritten: result.documentsWritten,
          namespace: result.namespace,
          duration: `${duration}ms`,
          contentType: params.contentType,
          source: params.source,
          errors: result.errors,
        };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';

        return {
          success: false,
          error: errorMessage,
          contentType: params.contentType,
          source: params.source,
        };
      }
    },
  });
