/**
 * Document Lifecycle DAL
 *
 * Implements draft/publish workflow for documents with version control.
 * Uses flag-based active version tracking (no circular FKs).
 */

import { db } from '@/lib/db/queries';
import {
  documentEnvelope,
  documentVersion,
  type DocumentVersion,
  type DocumentWithVersions,
} from '@/lib/db/schema';
import { eq, and, isNull, desc, max } from 'drizzle-orm';

// Import RAG sync functions (to be called when publishing)
// import { syncDocumentToRAG, removeDocumentFromRAG } from '@/lib/rag/sync';

/**
 * Helper: Move active flag from one version to another using clear-then-set pattern
 * Prevents unique constraint violations
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

export class DocumentsDAL {
  /**
   * Create new document with initial draft version
   */
  async createDocument(data: {
    title: string;
    content: string;
    messageId: string;
    workspaceId: string;
    userId: string;
    documentType?: string;
    kind?: 'text' | 'code' | 'table';
    metadata?: Record<string, unknown>;
  }): Promise<DocumentWithVersions> {
    return await db.transaction(async (tx) => {
      // 1. Create envelope
      const [envelope] = await tx
        .insert(documentEnvelope)
        .values({
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
   * Update existing draft OR create new draft version
   */
  async saveDocumentDraft(data: {
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
  async publishDocument(
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
      const [updated] = await tx
        .update(documentEnvelope)
        .set({
          isSearchable: makeSearchable,
          updatedAt: new Date(),
        })
        .where(eq(documentEnvelope.id, documentEnvelopeId))
        .returning();

      // TODO: Trigger RAG indexing if searchable
      if (makeSearchable) {
        const version = await tx.query.documentVersion.findFirst({
          where: eq(documentVersion.id, versionId),
        });

        if (version) {
          // await syncDocumentToRAG({
          //   id: documentEnvelopeId,
          //   title: updated.title,
          //   content: version.content,
          //   documentType: updated.documentType,
          //   workspaceId: updated.workspaceId,
          //   metadata: version.metadata
          // });
        }
      }
    });
  }

  /**
   * Unpublish a document
   */
  async unpublishDocument(documentEnvelopeId: string): Promise<void> {
    await db.transaction(async (tx) => {
      const envelope = await tx.query.documentEnvelope.findFirst({
        where: eq(documentEnvelope.id, documentEnvelopeId),
      });

      if (!envelope) throw new Error('Document not found');

      // Remove from RAG if it was searchable
      if (envelope.isSearchable) {
        // await removeDocumentFromRAG(documentEnvelopeId);
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
  async getPublishedDocuments(
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
   * Get document with all versions
   */
  async getDocumentWithVersions(
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

    const currentDraft =
      envelope.versions?.find((v) => v.isActiveDraft) || null;
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
  async getDraftCountByWorkspace(workspaceId: string): Promise<number> {
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
  async toggleDocumentSearchable(documentEnvelopeId: string): Promise<boolean> {
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
        // await syncDocumentToRAG({
        //   id: documentEnvelopeId,
        //   title: envelope.title,
        //   content: publishedVersion.content,
        //   documentType: envelope.documentType,
        //   workspaceId: envelope.workspaceId,
        //   metadata: publishedVersion.metadata
        // });
      } else {
        // await removeDocumentFromRAG(documentEnvelopeId);
      }

      return newSearchableState;
    });
  }

  /**
   * Create or get standalone draft (no message context)
   */
  async getOrCreateStandaloneDraft(
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
  async hasUnpublishedDraft(documentEnvelopeId: string): Promise<boolean> {
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
  async discardStandaloneDraft(documentEnvelopeId: string): Promise<void> {
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
  async cleanOrphanedVersions(workspaceId: string): Promise<number> {
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
}

// ============================================================================
// DEPRECATED: Backward compatibility exports for Phase 1
// These re-export the old DAL functions to prevent breaking changes
// TODO Phase 2: Remove these and update all consumers to use DocumentsDAL
// ============================================================================

export {
  saveDocument,
  updateDocument,
  deleteDocument,
  softDeleteDocument,
  getDocumentsById,
  getDocumentById,
  deleteDocumentsByIdAfterTimestamp,
  getAllUserDocuments,
  getWorkspaceDocumentsPaginated,
  getWorkspaceDocuments,
  getDocumentForUser,
  getDocumentsForUser,
  toggleDocumentSearchable,
  groupDocumentsByDate,
} from './documents-deprecated';
