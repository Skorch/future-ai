import { getLogger } from '@/lib/logger';

const logger = getLogger('documents');
import 'server-only';

import {
  and,
  asc,
  desc,
  eq,
  gt,
  inArray,
  isNull,
  lt,
  or,
  sql,
} from 'drizzle-orm';

import { document } from './schema';
import { db } from './queries';
import { syncDocumentToRAG, deleteFromRAG } from '@/lib/rag/sync';
import type { ArtifactKind } from '@/components/artifact';
import { generateUUID } from '../utils';
import { ChatSDKError } from '../errors';

export async function saveDocument({
  id,
  title,
  kind,
  content,
  userId,
  workspaceId,
  metadata,
  sourceDocumentIds,
}: {
  id?: string;
  title: string;
  kind: ArtifactKind;
  content: string;
  userId: string;
  workspaceId: string;
  metadata?: Record<string, unknown>;
  sourceDocumentIds?: string[];
}) {
  try {
    const documentId = id || generateUUID();

    const result = await db
      .insert(document)
      .values({
        id: documentId,
        title,
        kind,
        content,
        workspaceId,
        createdByUserId: userId,
        createdAt: new Date(),
        documentType: (metadata?.documentType as string) || 'text',
        isSearchable: true,
        metadata: (metadata || {}) as Record<string, unknown>,
        sourceDocumentIds: sourceDocumentIds || [],
      })
      .returning();

    // Automatically sync to RAG (async, don't await)
    logger.debug('[saveDocument] Starting RAG sync', {
      documentId,
      workspaceId,
      title,
      kind,
    });
    syncDocumentToRAG(documentId, workspaceId)
      .then(() => {
        logger.debug('[saveDocument] RAG sync completed successfully', {
          documentId,
          workspaceId,
        });
      })
      .catch((err) => {
        logger.error('[saveDocument] RAG sync failed', {
          documentId,
          workspaceId,
          title,
          kind,
          error: err,
          errorMessage: err instanceof Error ? err.message : String(err),
          errorStack: err instanceof Error ? err.stack : undefined,
        });
      });

    return result;
  } catch (error) {
    logger.error('[saveDocument] Database error:', error);
    throw new ChatSDKError('bad_request:database', 'Failed to save document');
  }
}

export async function updateDocument(
  id: string,
  updates: Partial<
    Omit<typeof document.$inferSelect, 'id' | 'createdAt' | 'userId'>
  >,
) {
  try {
    const result = await db
      .update(document)
      .set(updates)
      .where(eq(document.id, id))
      .returning();

    // Automatically sync to RAG (async, don't await)
    syncDocumentToRAG(id).catch((err) =>
      logger.error('[updateDocument] RAG sync failed:', err),
    );

    return result[0];
  } catch (error) {
    throw new ChatSDKError('bad_request:database', 'Failed to update document');
  }
}

// Keep old function name for backward compatibility (hard delete)
export async function deleteDocument(id: string, workspaceId: string) {
  try {
    // First verify the document belongs to this workspace
    const [doc] = await db
      .select()
      .from(document)
      .where(and(eq(document.id, id), eq(document.workspaceId, workspaceId)))
      .limit(1);

    if (!doc) {
      return null; // Document doesn't exist or doesn't belong to workspace
    }

    // Delete from RAG first (before document is gone)
    await deleteFromRAG(id, workspaceId);

    // Delete the document
    const result = await db
      .delete(document)
      .where(and(eq(document.id, id), eq(document.workspaceId, workspaceId)))
      .returning();

    return result[0];
  } catch (error) {
    throw new ChatSDKError('bad_request:database', 'Failed to delete document');
  }
}

// Soft delete with synchronous RAG cleanup
export async function softDeleteDocument(
  documentId: string,
  workspaceId: string,
) {
  try {
    // Remove from RAG first (SYNCHRONOUS - errors will rollback transaction)
    logger.debug('[softDeleteDocument] Starting RAG deletion', {
      documentId,
      workspaceId,
    });
    await deleteFromRAG(documentId, workspaceId);
    logger.debug('[softDeleteDocument] RAG deletion completed', {
      documentId,
      workspaceId,
    });

    // Soft delete by setting deletedAt timestamp
    const [deleted] = await db
      .update(document)
      .set({
        deletedAt: new Date(),
        isSearchable: false, // Ensure it's not searchable
      })
      .where(
        and(
          eq(document.id, documentId),
          eq(document.workspaceId, workspaceId),
          isNull(document.deletedAt), // Prevent double-delete (idempotent)
        ),
      )
      .returning();

    if (!deleted) {
      throw new ChatSDKError(
        'bad_request:database',
        'Document not found or already deleted',
      );
    }

    logger.info('[softDeleteDocument] Document soft deleted successfully', {
      documentId,
      workspaceId,
    });
    return deleted;
  } catch (error) {
    logger.error('[softDeleteDocument] Failed to soft delete document', {
      documentId,
      workspaceId,
      error,
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    throw error instanceof ChatSDKError
      ? error
      : new ChatSDKError('bad_request:database', 'Failed to delete document');
  }
}

export async function getDocumentsById({
  id,
  workspaceId,
}: { id: string; workspaceId: string }) {
  try {
    const documents = await db
      .select()
      .from(document)
      .where(
        and(
          eq(document.id, id),
          eq(document.workspaceId, workspaceId),
          isNull(document.deletedAt),
        ),
      )
      .orderBy(asc(document.createdAt));

    return documents;
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get documents by id',
    );
  }
}

export async function getDocumentById({
  id,
  workspaceId,
}: { id: string; workspaceId: string }) {
  try {
    const [selectedDocument] = await db
      .select()
      .from(document)
      .where(
        and(
          eq(document.id, id),
          eq(document.workspaceId, workspaceId),
          isNull(document.deletedAt),
        ),
      )
      .orderBy(desc(document.createdAt));

    return selectedDocument;
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get document by id',
    );
  }
}

export async function deleteDocumentsByIdAfterTimestamp({
  id,
  timestamp,
}: {
  id: string;
  timestamp: Date;
}) {
  try {
    return await db
      .delete(document)
      .where(and(eq(document.id, id), gt(document.createdAt, timestamp)))
      .returning();
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to delete documents by id after timestamp',
    );
  }
}

// Keep old function name for backward compatibility
export async function getAllUserDocuments({
  userId,
  workspaceId,
}: { userId: string; workspaceId: string }) {
  return getWorkspaceDocuments(workspaceId);
}

// Paginated version with search/filter/sort
export async function getWorkspaceDocumentsPaginated({
  workspaceId,
  limit = 50,
  cursor,
  search,
  type,
  sortBy = 'created',
  sortOrder = 'desc',
}: {
  workspaceId: string;
  limit?: number;
  cursor?: string; // Format: "timestamp_id"
  search?: string;
  type?: string;
  sortBy?: 'created' | 'title';
  sortOrder?: 'asc' | 'desc';
}) {
  try {
    // Parse cursor if provided
    let cursorDate: Date | null = null;
    let cursorId: string | null = null;
    if (cursor) {
      const [timestamp, id] = cursor.split('_');
      cursorDate = new Date(timestamp);
      cursorId = id;
    }

    // Build where conditions
    const conditions = [
      eq(document.workspaceId, workspaceId),
      isNull(document.deletedAt),
    ];

    // Add cursor conditions for pagination
    if (cursorDate && cursorId) {
      if (sortOrder === 'desc') {
        const cursorCondition = or(
          lt(document.createdAt, cursorDate),
          and(eq(document.createdAt, cursorDate), lt(document.id, cursorId)),
        );
        if (cursorCondition) conditions.push(cursorCondition);
      } else {
        const cursorCondition = or(
          gt(document.createdAt, cursorDate),
          and(eq(document.createdAt, cursorDate), gt(document.id, cursorId)),
        );
        if (cursorCondition) conditions.push(cursorCondition);
      }
    }

    // Add search filter (title search)
    if (search) {
      conditions.push(
        sql`LOWER(${document.title}) LIKE ${`%${search.toLowerCase()}%`}`,
      );
    }

    // Get documents with DISTINCT ON for latest version
    const documentsQuery = await db
      .selectDistinctOn([document.id], {
        id: document.id,
        title: document.title,
        createdAt: document.createdAt,
        metadata: document.metadata,
        sourceDocumentIds: document.sourceDocumentIds,
        contentLength: sql<number>`LENGTH(${document.content})`,
        contentPreview: sql<string>`SUBSTRING(${document.content}, 1, 500)`,
      })
      .from(document)
      .where(and(...conditions))
      .orderBy(
        document.id,
        sortOrder === 'desc'
          ? desc(document.createdAt)
          : asc(document.createdAt),
      )
      .limit(limit + 1); // Fetch one extra to check if more exist

    // Filter by type if specified (post-query since it's in metadata)
    let documents = documentsQuery.map((doc) => {
      const metadata = doc.metadata as {
        documentType?: string;
        fileName?: string;
        fileSize?: number;
        uploadedAt?: string;
        meetingDate?: string;
        participants?: string[];
        [key: string]: unknown;
      } | null;

      return {
        ...doc,
        estimatedTokens: Math.ceil(doc.contentLength / 4),
        humanReadableSize: formatBytes(doc.contentLength),
        documentType: metadata?.documentType || 'document',
        sourceDocumentIds: (doc.sourceDocumentIds || []) as string[],
        metadata,
      };
    });

    // Filter by type if specified
    if (type) {
      documents = documents.filter((doc) => doc.documentType === type);
    }

    // Sort by title if requested (post-query)
    if (sortBy === 'title') {
      documents.sort((a, b) =>
        sortOrder === 'desc'
          ? b.title.localeCompare(a.title)
          : a.title.localeCompare(b.title),
      );
    } else {
      // Sort by createdAt
      documents.sort((a, b) =>
        sortOrder === 'desc'
          ? b.createdAt.getTime() - a.createdAt.getTime()
          : a.createdAt.getTime() - b.createdAt.getTime(),
      );
    }

    // Check if there are more results
    const hasMore = documents.length > limit;
    const results = hasMore ? documents.slice(0, limit) : documents;

    // Generate next cursor from last item
    const nextCursor =
      hasMore && results.length > 0
        ? `${results[results.length - 1].createdAt.toISOString()}_${results[results.length - 1].id}`
        : null;

    // Get total count for the current filters
    const countConditions = [
      eq(document.workspaceId, workspaceId),
      isNull(document.deletedAt),
    ];
    if (search) {
      countConditions.push(
        sql`LOWER(${document.title}) LIKE ${`%${search.toLowerCase()}%`}`,
      );
    }

    const countResult = await db
      .select({ count: sql<number>`COUNT(DISTINCT ${document.id})` })
      .from(document)
      .where(and(...countConditions));

    let totalCount = countResult[0]?.count || 0;

    // Adjust count if type filter is applied (since it's post-query)
    if (type) {
      const allDocs = await db
        .selectDistinctOn([document.id], {
          id: document.id,
          metadata: document.metadata,
        })
        .from(document)
        .where(and(...countConditions))
        .orderBy(document.id);

      totalCount = allDocs.filter((doc) => {
        const meta = doc.metadata as { documentType?: string } | null;
        return meta?.documentType === type;
      }).length;
    }

    return {
      documents: results,
      totalCount,
      hasMore,
      nextCursor,
    };
  } catch (error) {
    logger.error('[getWorkspaceDocumentsPaginated] Error:', error);
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get workspace documents',
    );
  }
}

// New workspace-centric function name (non-paginated, for backwards compatibility)
export async function getWorkspaceDocuments(workspaceId: string) {
  try {
    // Get the latest version of each document by using DISTINCT ON with document.id
    // This ensures we only get one row per document ID (the most recent one)
    // We need to order by id first for DISTINCT ON, then by createdAt DESC to get the latest version
    const documentsQuery = await db
      .selectDistinctOn([document.id], {
        id: document.id,
        title: document.title,
        createdAt: document.createdAt,
        metadata: document.metadata,
        sourceDocumentIds: document.sourceDocumentIds,
        contentLength: sql<number>`LENGTH(${document.content})`,
        contentPreview: sql<string>`SUBSTRING(${document.content}, 1, 500)`,
      })
      .from(document)
      .where(
        and(eq(document.workspaceId, workspaceId), isNull(document.deletedAt)),
      )
      .orderBy(document.id, desc(document.createdAt));

    // Sort the final results by createdAt descending to show newest documents first
    const documents = documentsQuery.sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    );

    return documents.map((doc) => {
      const metadata = doc.metadata as {
        documentType?: string; // Generic string to match schema
        fileName?: string;
        fileSize?: number;
        uploadedAt?: string;
        meetingDate?: string;
        participants?: string[];
        [key: string]: unknown;
      } | null;

      return {
        ...doc,
        estimatedTokens: Math.ceil(doc.contentLength / 4),
        humanReadableSize: formatBytes(doc.contentLength),
        documentType: metadata?.documentType || 'document',
        sourceDocumentIds: (doc.sourceDocumentIds || []) as string[],
      };
    });
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get user documents',
    );
  }
}

export async function getDocumentForUser({
  documentId,
  userId,
  workspaceId,
  maxChars,
}: {
  documentId: string;
  userId: string;
  workspaceId: string;
  maxChars?: number;
}) {
  try {
    const query = db
      .select({
        id: document.id,
        title: document.title,
        content: maxChars
          ? sql<string>`SUBSTRING(${document.content}, 1, ${maxChars})`
          : document.content,
        metadata: document.metadata,
        sourceDocumentIds: document.sourceDocumentIds,
        createdAt: document.createdAt,
        fullContentLength: sql<number>`LENGTH(${document.content})`,
      })
      .from(document)
      .where(
        and(
          eq(document.id, documentId),
          eq(document.workspaceId, workspaceId),
          isNull(document.deletedAt),
        ),
      );

    const [doc] = await query;

    if (!doc) {
      return null;
    }

    return {
      ...doc,
      truncated: maxChars ? doc.fullContentLength > maxChars : false,
      loadedChars: maxChars
        ? Math.min(maxChars, doc.fullContentLength)
        : doc.fullContentLength,
    };
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get document for user',
    );
  }
}

export async function getDocumentsForUser({
  documentIds,
  userId,
  workspaceId,
  maxCharsPerDoc,
}: {
  documentIds: string[];
  userId: string;
  workspaceId: string;
  maxCharsPerDoc?: number;
}) {
  try {
    if (documentIds.length === 0) {
      return [];
    }

    const documents = await db
      .select({
        id: document.id,
        title: document.title,
        content: maxCharsPerDoc
          ? sql<string>`SUBSTRING(${document.content}, 1, ${maxCharsPerDoc})`
          : document.content,
        metadata: document.metadata,
        sourceDocumentIds: document.sourceDocumentIds,
        createdAt: document.createdAt,
        fullContentLength: sql<number>`LENGTH(${document.content})`,
      })
      .from(document)
      .where(
        and(
          inArray(document.id, documentIds),
          eq(document.workspaceId, workspaceId),
          isNull(document.deletedAt),
        ),
      );

    return documents.map((doc) => {
      const metadata = doc.metadata as {
        documentType?: string; // Generic string to match schema
        fileName?: string;
        fileSize?: number;
        uploadedAt?: string;
        meetingDate?: string;
        participants?: string[];
        [key: string]: unknown;
      } | null;

      return {
        ...doc,
        documentType: metadata?.documentType || 'document',
        truncated: maxCharsPerDoc
          ? doc.fullContentLength > maxCharsPerDoc
          : false,
        loadedChars: maxCharsPerDoc
          ? Math.min(maxCharsPerDoc, doc.fullContentLength)
          : doc.fullContentLength,
      };
    });
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get documents for user',
    );
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${Number.parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`;
}

// ============================================================================
// NEW FUNCTIONS FOR MILESTONE 1: Knowledge Management MVP
// ============================================================================

/**
 * Toggle document searchability and sync with RAG
 * Synchronous operation - errors will be thrown to caller
 */
export async function toggleDocumentSearchable(
  documentId: string,
  workspaceId: string,
  isSearchable: boolean,
) {
  try {
    logger.debug('[toggleDocumentSearchable] Starting', {
      documentId,
      workspaceId,
      isSearchable,
    });

    // Update database
    const [updated] = await db
      .update(document)
      .set({ isSearchable })
      .where(
        and(
          eq(document.id, documentId),
          eq(document.workspaceId, workspaceId),
          isNull(document.deletedAt),
        ),
      )
      .returning();

    if (!updated) {
      throw new ChatSDKError(
        'bad_request:database',
        'Document not found or already deleted',
      );
    }

    // Sync with RAG based on new state (SYNCHRONOUS)
    if (isSearchable) {
      logger.debug('[toggleDocumentSearchable] Adding to RAG', { documentId });
      await syncDocumentToRAG(documentId, workspaceId);
      logger.info('[toggleDocumentSearchable] Document added to RAG', {
        documentId,
      });
    } else {
      logger.debug('[toggleDocumentSearchable] Removing from RAG', {
        documentId,
      });
      await deleteFromRAG(documentId, workspaceId);
      logger.info('[toggleDocumentSearchable] Document removed from RAG', {
        documentId,
      });
    }

    return updated;
  } catch (error) {
    logger.error('[toggleDocumentSearchable] Failed', {
      documentId,
      workspaceId,
      isSearchable,
      error,
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    throw error instanceof ChatSDKError
      ? error
      : new ChatSDKError(
          'bad_request:database',
          'Failed to toggle document searchable',
        );
  }
}

/**
 * Group documents by date for UI display
 * Matches chat grouping logic for consistency
 */
export function groupDocumentsByDate<T extends { createdAt: Date }>(
  documents: T[],
): {
  today: T[];
  yesterday: T[];
  lastWeek: T[];
  lastMonth: T[];
  older: T[];
} {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const lastWeek = new Date(today);
  lastWeek.setDate(lastWeek.getDate() - 7);
  const lastMonth = new Date(today);
  lastMonth.setDate(lastMonth.getDate() - 30);

  return {
    today: documents.filter((d) => d.createdAt >= today),
    yesterday: documents.filter(
      (d) => d.createdAt >= yesterday && d.createdAt < today,
    ),
    lastWeek: documents.filter(
      (d) => d.createdAt >= lastWeek && d.createdAt < yesterday,
    ),
    lastMonth: documents.filter(
      (d) => d.createdAt >= lastMonth && d.createdAt < lastWeek,
    ),
    older: documents.filter((d) => d.createdAt < lastMonth),
  };
}

/**
 * Extract source chat metadata from document metadata
 * Returns undefined if no source chat info present
 */
function extractSourceChat(
  metadata: Record<string, unknown> | null,
): { id: string; title: string } | undefined {
  if (!metadata?.sourceChatId) return undefined;

  return {
    id: metadata.sourceChatId as string,
    title: (metadata.sourceChatTitle as string) || 'Untitled Chat',
  };
}
