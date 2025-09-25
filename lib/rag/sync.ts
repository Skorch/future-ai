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
export async function syncDocumentToRAG(
  documentId: string,
  workspaceId?: string,
): Promise<void> {
  try {
    // First try with provided workspaceId if available
    // This is a temporary fix - ideally we should always have workspaceId
    const doc = workspaceId
      ? await getDocumentById({ id: documentId, workspaceId })
      : null;

    // If no workspaceId provided or document not found, we can't proceed safely
    if (!doc) {
      console.log(
        `[RAG Sync] Cannot sync document ${documentId} without workspace context`,
      );
      return;
    }

    if (!doc?.content || !doc?.workspaceId) {
      console.log(
        `[RAG Sync] No content or workspaceId for document ${documentId}`,
      );
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
      `[RAG Sync] Document ${documentId} type: ${documentType}, workspaceId: ${doc.workspaceId}, metadata:`,
      doc.metadata,
    );

    // Delete existing chunks for this document
    await deleteFromRAG(documentId, doc.workspaceId);

    // Chunk based on document type - pass all document info for rich metadata
    const chunks = await chunkDocument(doc.content, documentId, documentType, {
      ...doc.metadata,
      userId: doc.createdByUserId,
      workspaceId: doc.workspaceId,
      title: doc.title,
      kind: doc.kind,
      createdAt: doc.createdAt,
    });

    if (chunks.length === 0) {
      console.log(`[RAG Sync] No chunks generated for ${documentId}`);
      return;
    }

    // Store in Pinecone
    await pineconeClient.writeDocuments(chunks, {
      namespace: doc.workspaceId,
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
    // If no namespace provided, we can't safely delete
    const workspaceId = namespace;
    if (!workspaceId) {
      // Cannot get document without workspaceId - this is a limitation
      // that should be fixed by always passing namespace/workspaceId
      console.log(
        `[RAG Sync] No workspaceId found for document ${documentId}, skipping delete`,
      );
      return;
    }

    // Use MongoDB-style operator for metadata filtering
    await pineconeClient.deleteByMetadata(
      {
        documentId: { $eq: documentId },
      },
      workspaceId,
    ); // Use workspaceId as namespace

    console.log(
      `[RAG Sync] Deleted all chunks for ${documentId} in namespace ${workspaceId}`,
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
      (metadata?.topics as string[]) || [],
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
