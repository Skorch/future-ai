import 'server-only';

import { PineconeClient } from '@/lib/rag/pinecone-client';
import { chunkTranscriptItems } from '@/lib/ai/utils/rag-chunker';
import {
  parseTranscript,
  parseDocument,
} from '@/lib/ai/utils/transcript-parser';
import crypto from 'node:crypto';
import type { TranscriptItem, RAGDocument, RAGMetadata } from './types';
import { getLogger } from '@/lib/logger';
import { getDocumentTypeDefinition } from '@/lib/artifacts';

const logger = getLogger('RAGSync');

/**
 * Parse meeting date string to ISO format
 * Handles formats like "September 11", "2024-09-11", "9/11/2024", etc.
 */
function parseMeetingDate(dateStr?: string): string | undefined {
  if (!dateStr) return undefined;

  try {
    // If already ISO format, return as is
    if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
      return new Date(dateStr).toISOString();
    }

    // Parse common date formats
    const date = new Date(dateStr);

    // Check if date is valid
    if (Number.isNaN(date.getTime())) {
      // Try adding current year if only month/day provided
      const currentYear = new Date().getFullYear();
      const dateWithYear = new Date(`${dateStr}, ${currentYear}`);

      if (!Number.isNaN(dateWithYear.getTime())) {
        return dateWithYear.toISOString();
      }

      logger.warn(`Could not parse meeting date: ${dateStr}`);
      return undefined;
    }

    return date.toISOString();
  } catch (error) {
    logger.warn(`Error parsing meeting date: ${dateStr}`, error);
    return undefined;
  }
}

const pineconeClient = new PineconeClient({
  indexName: process.env.PINECONE_INDEX_NAME || 'rag-agent-poc',
});

/**
 * Sync a document to RAG (UPSERT pattern)
 * Accepts document data directly - no DB fetch required
 */
export async function syncDocumentToRAG(doc: {
  id: string;
  workspaceId: string;
  content: string;
  title: string;
  documentType: string;
  kind?: string;
  metadata?: Record<string, unknown>;
  createdByUserId: string;
  createdAt: Date;
}): Promise<void> {
  logger.debug('Starting document sync', {
    documentId: doc.id,
    workspaceId: doc.workspaceId,
    documentType: doc.documentType,
  });

  try {
    if (!doc.content || !doc.workspaceId) {
      logger.debug(
        `[RAG Sync] No content or workspaceId for document ${doc.id}`,
      );
      return;
    }

    if (!doc.documentType) {
      logger.error(
        `ERROR: No documentType for ${doc.id}. Documents must have documentType set.`,
      );
      return;
    }

    logger.debug(
      `Document ${doc.id} type: ${doc.documentType}, workspaceId: ${doc.workspaceId}`,
    );

    // Delete existing chunks for this document
    await deleteFromRAG(doc.id, doc.workspaceId);

    // Chunk based on document type - pass all document info for rich metadata
    const chunks = await chunkDocument(doc.content, doc.id, doc.documentType, {
      ...doc.metadata,
      userId: doc.createdByUserId,
      workspaceId: doc.workspaceId,
      title: doc.title,
      kind: doc.kind || 'text',
      createdAt: doc.createdAt,
    });

    if (chunks.length === 0) {
      logger.debug(`No chunks generated for ${doc.id}`);
      return;
    }

    // Store in Pinecone
    await pineconeClient.writeDocuments(chunks, {
      namespace: doc.workspaceId,
    });

    logger.debug(
      `[RAG Sync] SUCCESS: Stored ${chunks.length} chunks for document`,
      {
        documentId: doc.id,
        workspaceId: doc.workspaceId,
        documentType: doc.documentType,
        title: doc.title,
        chunkCount: chunks.length,
      },
    );
  } catch (error) {
    logger.error(`ERROR: Failed to sync document`, {
      documentId: doc.id,
      workspaceId: doc.workspaceId,
      error,
      errorMessage: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
    });
    // Don't throw - RAG sync failures shouldn't break document operations
  }
}

/**
 * Delete all RAG entries for a document
 */
export async function deleteFromRAG(
  documentId: string,
  workspaceId: string,
): Promise<void> {
  try {
    // Use MongoDB-style operator for metadata filtering
    await pineconeClient.deleteByMetadata(
      {
        documentId: { $eq: documentId },
      },
      workspaceId,
    );

    logger.debug(
      `Deleted all chunks for ${documentId} in namespace ${workspaceId}`,
    );
  } catch (error) {
    logger.error(`Failed to delete ${documentId}:`, error);
  }
}

/**
 * Chunk document based on type
 */
async function chunkDocument(
  content: string,
  documentId: string,
  documentType: string,
  metadata: Record<string, unknown>,
): Promise<RAGDocument[]> {
  const chunks: RAGDocument[] = [];
  const fileHash = crypto.createHash('sha256').update(documentId).digest('hex');

  // Determine chunking strategy
  let chunkingStrategy = 'section-based'; // Default

  // Special case for transcripts (not in registry)
  if (documentType === 'transcript') {
    chunkingStrategy = 'ai-transcript';
  } else {
    // Try to get strategy from artifact metadata
    try {
      // Check if it's a valid DocumentType by checking the registry
      const { artifactRegistry } = await import('@/lib/artifacts');
      if (documentType in artifactRegistry) {
        const artifactDef = await getDocumentTypeDefinition(
          documentType as keyof typeof artifactRegistry,
        );
        if (artifactDef?.metadata?.chunkingStrategy) {
          chunkingStrategy = artifactDef.metadata.chunkingStrategy;
        }
      }
    } catch (error) {
      logger.debug(
        `[RAG Sync] Could not find artifact definition for ${documentType}, using default section-based chunking`,
      );
    }
  }

  // Apply chunking based on strategy
  if (chunkingStrategy === 'ai-transcript') {
    // AI-powered intelligent chunking for transcripts
    let items: TranscriptItem[];
    try {
      items = parseTranscript(content);
      logger.debug(
        `[RAG Sync] Parsed ${items.length} transcript items for ${documentId}`,
      );
    } catch (error) {
      logger.error(
        `[RAG Sync] Failed to parse transcript ${documentId}:`,
        error,
      );
      return [];
    }

    const topicChunks = await chunkTranscriptItems(
      items,
      (metadata?.topics as string[]) || [],
      {
        model: 'claude-sonnet-4',
        dryRun: false,
      },
    );

    logger.debug(
      `[RAG Sync] Generated ${topicChunks.length} topic chunks for ${documentId}`,
    );

    topicChunks.forEach((chunk, index) => {
      const chunkMetadata: RAGMetadata = {
        // Core identifiers (always present)
        documentId,
        documentType: 'transcript',
        userId: metadata.userId as string,

        // Document info (always present)
        title: metadata.title as string,
        kind: metadata.kind as string,
        createdAt: metadata.createdAt as string | Date,

        // Chunk specifics (always present)
        chunkIndex: index,
        totalChunks: topicChunks.length,
        fileHash,
        contentSource: 'transcript',

        // Content-specific fields
        topic: chunk.topic,
        speakers: chunk.metadata.speakers,
        startTime: chunk.metadata.startTime,
        endTime: chunk.metadata.endTime,

        // Meeting date - convert to ISO string if needed
        meetingDate: parseMeetingDate(
          metadata?.meetingDate as string | undefined,
        ),

        // Optional timestamps
        transcriptTimestamp: metadata?.transcriptTimestamp as
          | string
          | undefined,

        // Preserve artifact info if present
        artifactId: metadata?.artifactId as string | undefined,
        artifactTitle: metadata?.artifactTitle as string | undefined,
        artifactType: metadata?.artifactType as string | undefined,

        // File metadata if present
        fileName: metadata?.fileName as string | undefined,
        fileSize: metadata?.fileSize as number | undefined,
        uploadedAt: metadata?.uploadedAt as string | undefined,
      };

      chunks.push({
        id: `${documentId}-chunk-${index}`,
        content: chunk.content,
        metadata: chunkMetadata,
      });
    });
  } else if (chunkingStrategy === 'section-based') {
    // Section-based chunking for all document types that use this strategy
    const sections = parseDocument(content);
    logger.debug(`Parsed ${sections.length} sections from document`);

    sections.forEach((section, index) => {
      const chunkMetadata: RAGMetadata = {
        // Core identifiers (always present)
        documentId,
        documentType, // Use the actual document type
        userId: metadata.userId as string,

        // Document info (always present)
        title: metadata.title as string,
        kind: metadata.kind as string,
        createdAt: metadata.createdAt as string | Date,

        // Chunk specifics (always present)
        chunkIndex: index,
        totalChunks: sections.length,
        fileHash,
        contentSource: 'artifact',

        // Content-specific fields
        sectionTitle: section.speaker || `Section ${index + 1}`,

        // Meeting-specific fields
        sourceTranscriptIds: (metadata?.sourceDocumentIds as string[]) || [],
        meetingDate: parseMeetingDate(
          metadata?.meetingDate as string | undefined,
        ),
        participants: metadata?.participants as string[] | undefined,
        meetingDuration: metadata?.meetingDuration as string | undefined,

        // Preserve artifact metadata
        artifactId: metadata?.artifactId as string | undefined,
        artifactTitle: (metadata?.artifactTitle || metadata?.title) as
          | string
          | undefined,
        artifactType: (metadata?.artifactType || metadata?.kind) as
          | string
          | undefined,
        artifactCreatedAt: (metadata?.artifactCreatedAt ||
          metadata?.createdAt) as string | undefined,
      };

      chunks.push({
        id: `${documentId}-section-${index}`,
        content: section.text,
        metadata: chunkMetadata,
      });
    });
  } else if (chunkingStrategy === 'none') {
    // No chunking - treat entire document as single chunk
    logger.debug(
      `[RAG Sync] No chunking strategy for ${documentType}, treating as single chunk`,
    );
    const chunkMetadata: RAGMetadata = {
      // Core identifiers (always present)
      documentId,
      documentType,
      userId: metadata.userId as string,

      // Document info (always present)
      title: metadata.title as string,
      kind: metadata.kind as string,
      createdAt: metadata.createdAt as string | Date,

      // Chunk specifics (always present)
      chunkIndex: 0,
      totalChunks: 1,
      fileHash,
      contentSource: 'artifact',

      // Preserve any existing metadata
      artifactId: metadata?.artifactId as string | undefined,
      artifactTitle: (metadata?.artifactTitle || metadata?.title) as
        | string
        | undefined,
      artifactType: (metadata?.artifactType || metadata?.kind) as
        | string
        | undefined,
      artifactCreatedAt: (metadata?.artifactCreatedAt || metadata?.createdAt) as
        | string
        | undefined,
    };

    chunks.push({
      id: `${documentId}-full`,
      content,
      metadata: chunkMetadata,
    });
  } else {
    logger.warn(
      `[RAG Sync] Unknown chunking strategy '${chunkingStrategy}' for ${documentType}, falling back to section-based`,
    );
    // Fallback to section-based chunking for unknown strategies
    const sections = parseDocument(content);

    sections.forEach((section, index) => {
      const chunkMetadata: RAGMetadata = {
        // Core identifiers (always present)
        documentId,
        documentType,
        userId: metadata.userId as string,

        // Document info (always present)
        title: metadata.title as string,
        kind: metadata.kind as string,
        createdAt: metadata.createdAt as string | Date,

        // Chunk specifics (always present)
        chunkIndex: index,
        totalChunks: sections.length,
        fileHash,
        contentSource: 'unknown',

        // Content-specific fields
        sectionTitle: section.speaker || `Section ${index + 1}`,

        // Preserve any existing metadata
        artifactId: metadata?.artifactId as string | undefined,
        artifactTitle: (metadata?.artifactTitle || metadata?.title) as
          | string
          | undefined,
        artifactType: (metadata?.artifactType || metadata?.kind) as
          | string
          | undefined,
        artifactCreatedAt: (metadata?.artifactCreatedAt ||
          metadata?.createdAt) as string | undefined,
      };

      chunks.push({
        id: `${documentId}-section-${index}`,
        content: section.text,
        metadata: chunkMetadata,
      });
    });
  }

  return chunks;
}

// Export functions directly - no unnecessary abstraction
