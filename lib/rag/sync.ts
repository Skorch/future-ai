import { getDocumentById } from '@/lib/db/queries';
import { PineconeClient } from '@/lib/rag/pinecone-client';
import { chunkTranscriptItems } from '@/lib/ai/utils/rag-chunker';
import {
  parseTranscript,
  parseDocument,
} from '@/lib/ai/utils/transcript-parser';
import crypto from 'node:crypto';
import type { TranscriptItem, RAGDocument, RAGMetadata } from './types';

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

      console.warn(`[RAG Sync] Could not parse meeting date: ${dateStr}`);
      return undefined;
    }

    return date.toISOString();
  } catch (error) {
    console.warn(`[RAG Sync] Error parsing meeting date: ${dateStr}`, error);
    return undefined;
  }
}

const pineconeClient = new PineconeClient({
  indexName: process.env.PINECONE_INDEX_NAME || 'rag-agent-poc',
});

/**
 * Sync a document to RAG (UPSERT pattern)
 */
export async function syncDocumentToRAG(documentId: string): Promise<void> {
  try {
    const doc = await getDocumentById({ id: documentId });
    if (!doc?.content || !doc?.userId) {
      console.log(`[RAG Sync] No content or userId for document ${documentId}`);
      return;
    }

    // Get document type from metadata - REQUIRED for proper processing
    const documentType = doc.metadata?.documentType;

    if (!documentType) {
      console.error(
        `[RAG Sync] ERROR: No documentType in metadata for ${documentId}. Documents must have documentType set.`,
      );
      console.error(`[RAG Sync] Metadata received:`, doc.metadata);
      // Skip RAG sync for documents without proper metadata
      return;
    }

    console.log(
      `[RAG Sync] Document ${documentId} type: ${documentType}, userId: ${doc.userId}, metadata:`,
      doc.metadata,
    );

    // Delete existing chunks for this document (use userId as namespace)
    await deleteFromRAG(documentId, doc.userId);

    // Chunk based on document type - pass all document info for rich metadata
    const chunks = await chunkDocument(doc.content, documentId, documentType, {
      ...doc.metadata,
      userId: doc.userId,
      title: doc.title,
      kind: doc.kind,
      createdAt: doc.createdAt,
    });

    if (chunks.length === 0) {
      console.log(`[RAG Sync] No chunks generated for ${documentId}`);
      return;
    }

    // Store in Pinecone with userId as namespace for isolation
    await pineconeClient.writeDocuments(chunks, {
      namespace: doc.userId,
    });

    console.log(`[RAG Sync] Stored ${chunks.length} chunks for ${documentId}`);
  } catch (error) {
    console.error(`[RAG Sync] Failed to sync ${documentId}:`, error);
    // Don't throw - RAG sync failures shouldn't break document operations
  }
}

/**
 * Delete all RAG entries for a document
 */
export async function deleteFromRAG(
  documentId: string,
  namespace?: string,
): Promise<void> {
  try {
    // If no namespace provided, we need to get the document to find the userId
    let userId = namespace;
    if (!userId) {
      const doc = await getDocumentById({ id: documentId });
      userId = doc?.userId;
      if (!userId) {
        console.log(
          `[RAG Sync] No userId found for document ${documentId}, skipping delete`,
        );
        return;
      }
    }

    // Use MongoDB-style operator for metadata filtering
    await pineconeClient.deleteByMetadata(
      {
        documentId: { $eq: documentId },
      },
      userId,
    ); // Use userId as namespace

    console.log(
      `[RAG Sync] Deleted all chunks for ${documentId} in namespace ${userId}`,
    );
  } catch (error) {
    console.error(`[RAG Sync] Failed to delete ${documentId}:`, error);
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

  if (documentType === 'transcript') {
    // AI-powered intelligent chunking for transcripts
    let items: TranscriptItem[];
    try {
      items = parseTranscript(content);
      console.log(
        `[RAG Sync] Parsed ${items.length} transcript items for ${documentId}`,
      );
    } catch (error) {
      console.error(
        `[RAG Sync] Failed to parse transcript ${documentId}:`,
        error,
      );
      return [];
    }

    const topicChunks = await chunkTranscriptItems(
      items,
      metadata?.topics || [],
      {
        model: 'claude-sonnet-4',
        dryRun: false,
      },
    );

    console.log(
      `[RAG Sync] Generated ${topicChunks.length} topic chunks for ${documentId}`,
    );

    topicChunks.forEach((chunk, index) => {
      const chunkMetadata: RAGMetadata = {
        // Core identifiers (always present)
        documentId,
        documentType: 'transcript',
        userId: metadata.userId,

        // Document info (always present)
        title: metadata.title,
        kind: metadata.kind,
        createdAt: metadata.createdAt,

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
        meetingDate: parseMeetingDate(metadata?.meetingDate),

        // Optional timestamps
        transcriptTimestamp: metadata?.transcriptTimestamp,

        // Preserve artifact info if present
        artifactId: metadata?.artifactId,
        artifactTitle: metadata?.artifactTitle,
        artifactType: metadata?.artifactType,

        // File metadata if present
        fileName: metadata?.fileName,
        fileSize: metadata?.fileSize,
        uploadedAt: metadata?.uploadedAt,
      };

      chunks.push({
        id: `${documentId}-chunk-${index}`,
        content: chunk.content,
        metadata: chunkMetadata,
      });
    });
  } else if (
    documentType === 'meeting-summary' ||
    documentType === 'document'
  ) {
    // Simple section-based chunking for summaries and generic documents
    const sections = parseDocument(content);
    console.log(`[RAG Sync] Parsed ${sections.length} sections from document`);

    sections.forEach((section, index) => {
      const chunkMetadata: RAGMetadata = {
        // Core identifiers (always present)
        documentId,
        documentType:
          documentType === 'meeting-summary' ? 'meeting-summary' : 'document',
        userId: metadata.userId,

        // Document info (always present)
        title: metadata.title,
        kind: metadata.kind,
        createdAt: metadata.createdAt,

        // Chunk specifics (always present)
        chunkIndex: index,
        totalChunks: sections.length,
        fileHash,
        contentSource: 'artifact',

        // Content-specific fields
        sectionTitle: section.speaker || `Section ${index + 1}`,

        // Meeting-specific fields
        sourceTranscriptIds: metadata?.sourceDocumentIds || [],
        meetingDate: parseMeetingDate(metadata?.meetingDate),
        participants: metadata?.participants,
        meetingDuration: metadata?.meetingDuration,

        // Preserve artifact metadata
        artifactId: metadata?.artifactId,
        artifactTitle: metadata?.artifactTitle || metadata?.title,
        artifactType: metadata?.artifactType || metadata?.kind,
        artifactCreatedAt: metadata?.artifactCreatedAt || metadata?.createdAt,
      };

      chunks.push({
        id: `${documentId}-section-${index}`,
        content: section.text,
        metadata: chunkMetadata,
      });
    });
  } else {
    console.log(
      `[RAG Sync] Unknown document type: ${documentType}, using section-based chunking`,
    );
    // Fallback to section-based chunking for unknown types
    const sections = parseDocument(content);

    sections.forEach((section, index) => {
      const chunkMetadata: RAGMetadata = {
        // Core identifiers (always present)
        documentId,
        documentType,
        userId: metadata.userId,

        // Document info (always present)
        title: metadata.title,
        kind: metadata.kind,
        createdAt: metadata.createdAt,

        // Chunk specifics (always present)
        chunkIndex: index,
        totalChunks: sections.length,
        fileHash,
        contentSource: 'unknown',

        // Content-specific fields
        sectionTitle: section.speaker || `Section ${index + 1}`,

        // Preserve any existing metadata
        artifactId: metadata?.artifactId,
        artifactTitle: metadata?.artifactTitle || metadata?.title,
        artifactType: metadata?.artifactType || metadata?.kind,
        artifactCreatedAt: metadata?.artifactCreatedAt || metadata?.createdAt,
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
