/**
 * Document Lifecycle DAL
 *
 * Implements draft/publish workflow for documents with version control.
 * Uses flag-based active version tracking (no circular FKs).
 */

import 'server-only';

import { db } from '@/lib/db/queries';
import {
  documentEnvelope,
  documentVersion,
  type DocumentVersion,
  type DocumentWithVersions,
} from '@/lib/db/schema';
import { eq, and, isNull, desc, asc, max } from 'drizzle-orm';

// Import RAG sync functions
import { syncDocumentToRAG, deleteFromRAG } from '@/lib/rag/sync';

/**
 * Helper: Move active flag from one version to another using clear-then-set pattern
 * Prevents unique constraint violations from partial unique indexes
 */
async function moveActiveFlag(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  envelopeId: string,
  newVersionId: string,
  flagName: 'isActiveDraft' | 'isActivePublished',
) {
  // Step 1: Clear all active flags for this envelope
  await tx
    .update(documentVersion)
    .set({ [flagName]: false })
    .where(
      and(
        eq(documentVersion.documentEnvelopeId, envelopeId),
        eq(documentVersion[flagName], true),
      ),
    );

  // Step 2: Set the new active flag
  await tx
    .update(documentVersion)
    .set({ [flagName]: true })
    .where(eq(documentVersion.id, newVersionId));
}

/**
 * Create new document with initial draft version
 */
export async function createDocument(data: {
  id?: string; // Optional: pre-generated envelope ID (for backward compat with AI tool)
  title: string;
  content: string;
  messageId: string | null; // NULL for standalone documents (transcripts, manual uploads)
  workspaceId: string;
  userId: string;
  documentType?: string;
  kind?: 'text' | 'code' | 'table';
  metadata?: Record<string, unknown>;
}): Promise<DocumentWithVersions> {
  return await db.transaction(async (tx) => {
    // 1. Create envelope (use provided ID or let DB generate)
    const [envelope] = await tx
      .insert(documentEnvelope)
      .values({
        id: data.id, // Use pre-generated ID if provided
        title: data.title,
        documentType: data.documentType,
        workspaceId: data.workspaceId,
        createdByUserId: data.userId,
      })
      .returning();

    // 2. Create first version with isActiveDraft = true
    const [version] = await tx
      .insert(documentVersion)
      .values({
        documentEnvelopeId: envelope.id,
        workspaceId: data.workspaceId,
        messageId: data.messageId,
        content: data.content,
        metadata: data.metadata,
        kind: data.kind || 'text',
        versionNumber: 1,
        isActiveDraft: true,
        isActivePublished: false,
        createdByUserId: data.userId,
      })
      .returning();

    return {
      envelope,
      currentDraft: version,
      currentPublished: null,
      allVersions: [version],
    };
  });
}

/**
 * Link document versions to assistant message after message is saved
 * Called from onFinish callback in chat route
 */
export async function updateDocumentVersionsMessageId(
  updates: Array<{ versionId: string; messageId: string }>,
): Promise<void> {
  if (updates.length === 0) return;

  await db.transaction(async (tx) => {
    for (const { versionId, messageId } of updates) {
      await tx
        .update(documentVersion)
        .set({ messageId })
        .where(eq(documentVersion.id, versionId));
    }
  });
}

/**
 * Update existing draft OR create new draft version
 */
export async function saveDocumentDraft(data: {
  documentEnvelopeId: string;
  content: string;
  messageId: string;
  workspaceId: string;
  userId: string;
  metadata?: Record<string, unknown>;
}): Promise<DocumentVersion> {
  return await db.transaction(async (tx) => {
    // Get current active draft
    const currentDraft = await tx.query.documentVersion.findFirst({
      where: and(
        eq(documentVersion.documentEnvelopeId, data.documentEnvelopeId),
        eq(documentVersion.isActiveDraft, true),
      ),
    });

    // If editing existing draft from same message context, UPDATE in place
    if (currentDraft && currentDraft.messageId === data.messageId) {
      const [updated] = await tx
        .update(documentVersion)
        .set({
          content: data.content,
          metadata: data.metadata,
        })
        .where(eq(documentVersion.id, currentDraft.id))
        .returning();

      return updated;
    }

    // Otherwise create new version
    const maxVersion = await tx
      .select({ max: max(documentVersion.versionNumber) })
      .from(documentVersion)
      .where(eq(documentVersion.documentEnvelopeId, data.documentEnvelopeId));

    const nextVersion = (maxVersion[0].max || 0) + 1;

    const [version] = await tx
      .insert(documentVersion)
      .values({
        documentEnvelopeId: data.documentEnvelopeId,
        workspaceId: data.workspaceId,
        messageId: data.messageId,
        content: data.content,
        metadata: data.metadata,
        versionNumber: nextVersion,
        isActiveDraft: false, // Will be set to true below
        isActivePublished: false,
        createdByUserId: data.userId,
      })
      .returning();

    // Move active draft flag to new version
    await moveActiveFlag(
      tx,
      data.documentEnvelopeId,
      version.id,
      'isActiveDraft',
    );

    return version;
  });
}

/**
 * Publish a draft version
 */
export async function publishDocument(
  documentEnvelopeId: string,
  versionId: string,
  makeSearchable: boolean,
): Promise<void> {
  await db.transaction(async (tx) => {
    // Move active published flag to this version
    await moveActiveFlag(
      tx,
      documentEnvelopeId,
      versionId,
      'isActivePublished',
    );

    // Update envelope searchable flag
    const [envelope] = await tx
      .update(documentEnvelope)
      .set({
        isSearchable: makeSearchable,
        updatedAt: new Date(),
      })
      .where(eq(documentEnvelope.id, documentEnvelopeId))
      .returning();

    // Trigger RAG indexing if searchable
    if (makeSearchable) {
      const version = await tx.query.documentVersion.findFirst({
        where: eq(documentVersion.id, versionId),
      });

      if (version && envelope) {
        await syncDocumentToRAG({
          id: documentEnvelopeId,
          workspaceId: envelope.workspaceId,
          content: version.content,
          title: envelope.title,
          documentType: envelope.documentType || 'text',
          kind: version.kind,
          metadata: version.metadata || {},
          createdByUserId: version.createdByUserId,
          createdAt: version.createdAt,
        });
      }
    }
  });
}

/**
 * Unpublish a document
 */
export async function unpublishDocument(
  documentEnvelopeId: string,
): Promise<void> {
  await db.transaction(async (tx) => {
    const envelope = await tx.query.documentEnvelope.findFirst({
      where: eq(documentEnvelope.id, documentEnvelopeId),
    });

    if (!envelope) throw new Error('Document not found');

    // Remove from RAG if it was searchable
    if (envelope.isSearchable) {
      await deleteFromRAG(documentEnvelopeId, envelope.workspaceId);
    }

    // Clear published flag on all versions
    await tx
      .update(documentVersion)
      .set({ isActivePublished: false })
      .where(
        and(
          eq(documentVersion.documentEnvelopeId, documentEnvelopeId),
          eq(documentVersion.isActivePublished, true),
        ),
      );

    // Clear searchable flag on envelope
    await tx
      .update(documentEnvelope)
      .set({
        isSearchable: false,
        updatedAt: new Date(),
      })
      .where(eq(documentEnvelope.id, documentEnvelopeId));
  });
}

/**
 * Get only published documents for workspace
 */
export async function getPublishedDocuments(
  workspaceId: string,
): Promise<DocumentWithVersions[]> {
  const envelopes = await db.query.documentEnvelope.findMany({
    where: eq(documentEnvelope.workspaceId, workspaceId),
    with: {
      versions: {
        where: eq(documentVersion.isActivePublished, true),
        limit: 1,
      },
    },
  });

  return envelopes
    .filter((e) => e.versions.length > 0) // Only include if published version exists
    .map((e) => ({
      envelope: e,
      currentPublished: e.versions[0],
      currentDraft: null,
      allVersions: [],
    }));
}

/**
 * Get all documents for workspace (for list-documents tool)
 * Returns published documents in format compatible with AI tool expectations
 */
export async function getAllWorkspaceDocuments(workspaceId: string) {
  const envelopes = await db.query.documentEnvelope.findMany({
    where: eq(documentEnvelope.workspaceId, workspaceId),
    with: {
      versions: {
        where: eq(documentVersion.isActivePublished, true),
        limit: 1,
      },
    },
    orderBy: desc(documentEnvelope.createdAt),
  });

  // Filter to only published documents and format for tool compatibility
  return envelopes
    .filter((e) => e.versions.length > 0)
    .map((e) => {
      const publishedVersion = e.versions[0];
      const contentLength = publishedVersion.content.length;
      const estimatedTokens = Math.ceil(contentLength / 4); // Rough estimate: 1 token ≈ 4 chars

      return {
        id: e.id,
        title: e.title,
        documentType: e.documentType || 'text',
        kind: publishedVersion.kind,
        content: publishedVersion.content,
        contentLength,
        estimatedTokens,
        contentPreview: publishedVersion.content.slice(0, 200),
        createdAt: publishedVersion.createdAt,
        workspaceId: e.workspaceId,
        metadata: publishedVersion.metadata || {},
        createdByUserId: publishedVersion.createdByUserId,
        isSearchable: e.isSearchable,
      };
    });
}

/**
 * Get single published document by ID (for load-document tool)
 */
export async function getPublishedDocumentById(
  documentId: string,
  workspaceId: string,
) {
  const envelope = await db.query.documentEnvelope.findFirst({
    where: and(
      eq(documentEnvelope.id, documentId),
      eq(documentEnvelope.workspaceId, workspaceId),
    ),
    with: {
      versions: {
        where: eq(documentVersion.isActivePublished, true),
        limit: 1,
      },
    },
  });

  if (!envelope || envelope.versions.length === 0) {
    return null; // Not found or not published
  }

  const publishedVersion = envelope.versions[0];
  const contentLength = publishedVersion.content.length;
  const estimatedTokens = Math.ceil(contentLength / 4);

  return {
    id: envelope.id,
    title: envelope.title,
    documentType: envelope.documentType || 'text',
    kind: publishedVersion.kind,
    content: publishedVersion.content,
    contentLength,
    estimatedTokens,
    contentPreview: publishedVersion.content.slice(0, 200),
    createdAt: publishedVersion.createdAt,
    workspaceId: envelope.workspaceId,
    metadata: publishedVersion.metadata || {},
    createdByUserId: publishedVersion.createdByUserId,
    isSearchable: envelope.isSearchable,
  };
}

/**
 * Get multiple published documents by IDs (for load-documents tool)
 */
export async function getPublishedDocumentsByIds(
  documentIds: string[],
  workspaceId: string,
) {
  const envelopes = await db.query.documentEnvelope.findMany({
    where: and(
      eq(documentEnvelope.workspaceId, workspaceId),
      // Note: Drizzle doesn't have `in` operator, so we need to filter in memory
    ),
    with: {
      versions: {
        where: eq(documentVersion.isActivePublished, true),
        limit: 1,
      },
    },
  });

  // Filter by IDs and only published
  return envelopes
    .filter((e) => documentIds.includes(e.id) && e.versions.length > 0)
    .map((e) => {
      const publishedVersion = e.versions[0];
      const contentLength = publishedVersion.content.length;
      const estimatedTokens = Math.ceil(contentLength / 4);

      return {
        id: e.id,
        title: e.title,
        documentType: e.documentType || 'text',
        kind: publishedVersion.kind,
        content: publishedVersion.content,
        contentLength,
        estimatedTokens,
        contentPreview: publishedVersion.content.slice(0, 200),
        createdAt: publishedVersion.createdAt,
        workspaceId: e.workspaceId,
        metadata: publishedVersion.metadata || {},
        createdByUserId: publishedVersion.createdByUserId,
        isSearchable: e.isSearchable,
      };
    });
}

/**
 * Get document with all versions
 */
export async function getDocumentWithVersions(
  documentEnvelopeId: string,
): Promise<DocumentWithVersions | null> {
  const envelope = await db.query.documentEnvelope.findFirst({
    where: eq(documentEnvelope.id, documentEnvelopeId),
    with: {
      versions: {
        orderBy: desc(documentVersion.versionNumber),
      },
    },
  });

  if (!envelope) return null;

  const currentDraft = envelope.versions?.find((v) => v.isActiveDraft) || null;
  const currentPublished =
    envelope.versions?.find((v) => v.isActivePublished) || null;

  return {
    envelope,
    currentDraft,
    currentPublished,
    allVersions: envelope.versions || [],
  };
}

/**
 * Count draft documents per workspace (unpublished only)
 */
/**
 * Get all versions for a document envelope (for backward compatibility)
 */
export async function getAllVersionsForDocument(documentEnvelopeId: string) {
  const versions = await db.query.documentVersion.findMany({
    where: eq(documentVersion.documentEnvelopeId, documentEnvelopeId),
    orderBy: asc(documentVersion.createdAt),
  });

  return versions;
}

export async function getDraftCountByWorkspace(
  workspaceId: string,
): Promise<number> {
  const results = await db
    .select({
      envelopeId: documentVersion.documentEnvelopeId,
    })
    .from(documentVersion)
    .where(
      and(
        eq(documentVersion.workspaceId, workspaceId),
        eq(documentVersion.isActiveDraft, true),
        eq(documentVersion.isActivePublished, false),
      ),
    )
    .groupBy(documentVersion.documentEnvelopeId);

  return results.length;
}

/**
 * Toggle document searchability
 */
export async function toggleDocumentSearchable(
  documentEnvelopeId: string,
): Promise<boolean> {
  return await db.transaction(async (tx) => {
    const envelope = await tx.query.documentEnvelope.findFirst({
      where: eq(documentEnvelope.id, documentEnvelopeId),
    });

    if (!envelope) {
      throw new Error('Document not found');
    }

    // Check if there's a published version
    const publishedVersion = await tx.query.documentVersion.findFirst({
      where: and(
        eq(documentVersion.documentEnvelopeId, documentEnvelopeId),
        eq(documentVersion.isActivePublished, true),
      ),
    });

    if (!publishedVersion) {
      throw new Error('Document not published');
    }

    const newSearchableState = !envelope.isSearchable;

    // Update the flag
    await tx
      .update(documentEnvelope)
      .set({
        isSearchable: newSearchableState,
        updatedAt: new Date(),
      })
      .where(eq(documentEnvelope.id, documentEnvelopeId));

    // Sync with RAG
    if (newSearchableState) {
      await syncDocumentToRAG({
        id: documentEnvelopeId,
        workspaceId: envelope.workspaceId,
        content: publishedVersion.content,
        title: envelope.title,
        documentType: envelope.documentType || 'text',
        kind: publishedVersion.kind,
        metadata: publishedVersion.metadata || {},
        createdByUserId: publishedVersion.createdByUserId,
        createdAt: publishedVersion.createdAt,
      });
    } else {
      await deleteFromRAG(documentEnvelopeId, envelope.workspaceId);
    }

    return newSearchableState;
  });
}

/**
 * Create or get standalone draft (no message context)
 */
export async function getOrCreateStandaloneDraft(
  documentEnvelopeId: string,
  workspaceId: string,
  userId: string,
): Promise<DocumentVersion> {
  return await db.transaction(async (tx) => {
    // Check for existing standalone draft (messageId = null, isActiveDraft = true)
    const existingDraft = await tx.query.documentVersion.findFirst({
      where: and(
        eq(documentVersion.documentEnvelopeId, documentEnvelopeId),
        eq(documentVersion.isActiveDraft, true),
        isNull(documentVersion.messageId),
      ),
    });

    if (existingDraft) {
      return existingDraft; // Reuse existing standalone draft
    }

    // Get published content to copy
    const published = await tx.query.documentVersion.findFirst({
      where: and(
        eq(documentVersion.documentEnvelopeId, documentEnvelopeId),
        eq(documentVersion.isActivePublished, true),
      ),
    });

    if (!published) {
      throw new Error('Cannot create draft - no published version exists');
    }

    // Get next version number
    const maxVersion = await tx
      .select({ max: max(documentVersion.versionNumber) })
      .from(documentVersion)
      .where(eq(documentVersion.documentEnvelopeId, documentEnvelopeId));

    // Create new standalone draft
    const [draft] = await tx
      .insert(documentVersion)
      .values({
        documentEnvelopeId,
        workspaceId,
        messageId: null, // No message context - marks as standalone
        content: published.content,
        metadata: published.metadata,
        kind: published.kind,
        versionNumber: (maxVersion[0].max || 0) + 1,
        isActiveDraft: false, // Will be set to true below
        isActivePublished: false,
        createdByUserId: userId,
      })
      .returning();

    // Move active draft flag to new version
    await moveActiveFlag(tx, documentEnvelopeId, draft.id, 'isActiveDraft');

    return draft;
  });
}

/**
 * Check if document has unpublished changes
 */
export async function hasUnpublishedDraft(
  documentEnvelopeId: string,
): Promise<boolean> {
  const draft = await db.query.documentVersion.findFirst({
    where: and(
      eq(documentVersion.documentEnvelopeId, documentEnvelopeId),
      eq(documentVersion.isActiveDraft, true),
    ),
  });

  const published = await db.query.documentVersion.findFirst({
    where: and(
      eq(documentVersion.documentEnvelopeId, documentEnvelopeId),
      eq(documentVersion.isActivePublished, true),
    ),
  });

  // Has draft and either no published or draft differs from published
  return !!(draft && (!published || draft.id !== published.id));
}

/**
 * Discard standalone draft
 */
export async function discardStandaloneDraft(
  documentEnvelopeId: string,
): Promise<void> {
  await db.transaction(async (tx) => {
    // Find standalone draft (messageId = null, isActiveDraft = true)
    const draft = await tx.query.documentVersion.findFirst({
      where: and(
        eq(documentVersion.documentEnvelopeId, documentEnvelopeId),
        eq(documentVersion.isActiveDraft, true),
        isNull(documentVersion.messageId),
      ),
    });

    if (!draft) return; // Not a standalone draft

    // Delete the draft version
    await tx.delete(documentVersion).where(eq(documentVersion.id, draft.id));
  });
}

/**
 * Clean orphaned versions from workspace (Phase 3)
 * Orphaned = messageId IS NULL AND isActivePublished = false
 */
export async function cleanOrphanedVersions(
  workspaceId: string,
): Promise<number> {
  const result = await db
    .delete(documentVersion)
    .where(
      and(
        eq(documentVersion.workspaceId, workspaceId),
        isNull(documentVersion.messageId),
        eq(documentVersion.isActivePublished, false),
      ),
    )
    .returning({ id: documentVersion.id });

  return result.length;
}

/**
 * Get paginated workspace documents (simplified version)
 * TODO: Implement proper cursor-based pagination
 */
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
  cursor?: string;
  search?: string;
  type?: string;
  sortBy?: 'created' | 'title';
  sortOrder?: 'asc' | 'desc';
}) {
  // For now, get all documents and filter/sort in memory
  // TODO: Implement proper DB-level pagination with cursor
  let documents = await getAllWorkspaceDocuments(workspaceId);

  // Apply search filter
  if (search) {
    const searchLower = search.toLowerCase();
    documents = documents.filter((doc) =>
      doc.title.toLowerCase().includes(searchLower),
    );
  }

  // Apply type filter
  if (type) {
    documents = documents.filter((doc) => doc.documentType === type);
  }

  // Sort
  documents.sort((a, b) => {
    if (sortBy === 'title') {
      return sortOrder === 'desc'
        ? b.title.localeCompare(a.title)
        : a.title.localeCompare(b.title);
    }
    // Sort by createdAt
    return sortOrder === 'desc'
      ? b.createdAt.getTime() - a.createdAt.getTime()
      : a.createdAt.getTime() - b.createdAt.getTime();
  });

  // Apply pagination (simple offset-based for now)
  // TODO: Implement proper cursor-based pagination
  const offset = cursor ? Number.parseInt(cursor, 10) : 0;
  const hasMore = documents.length > offset + limit;
  const results = documents.slice(offset, offset + limit);
  const nextCursor = hasMore ? String(offset + limit) : null;

  return {
    documents: results,
    totalCount: documents.length,
    hasMore,
    nextCursor,
  };
}

// ============================================================================
// DEPRECATED: Backward compatibility exports - REMOVED TO FORCE MIGRATION
// ============================================================================

// export {
//   saveDocument,
//   updateDocument,
//   deleteDocument,
//   softDeleteDocument,
//   getDocumentsById,
//   getDocumentById,
//   deleteDocumentsByIdAfterTimestamp,
//   getAllUserDocuments,
//   getWorkspaceDocumentsPaginated,
//   getWorkspaceDocuments,
//   getDocumentForUser,
//   getDocumentsForUser,
//   groupDocumentsByDate,
// } from './documents-deprecated';

// Note: All deprecated functions have been removed to force migration to new schema
// Use new functions: createDocument, getDocumentWithVersions, publishDocument, etc.
