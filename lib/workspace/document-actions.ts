'use server';

import { auth } from '@clerk/nextjs/server';
import {
  publishDocument,
  unpublishDocument,
  toggleDocumentSearchable,
  discardStandaloneDraft,
  getDocumentWithVersions,
  getOrCreateStandaloneDraft,
  saveDocumentDraft,
} from '@/lib/db/documents';
import { getLogger } from '@/lib/logger';
import { revalidateDocumentPaths } from '@/lib/cache/document-cache.server';

const logger = getLogger('DocumentActions');

/**
 * Publish a draft document version
 */
export async function publishDocumentAction(
  documentEnvelopeId: string,
  versionId: string,
  makeSearchable: boolean,
  workspaceId: string,
) {
  const { userId } = await auth();

  if (!userId) {
    throw new Error('Unauthorized');
  }

  try {
    // Security: Verify user has access to this document's workspace
    const doc = await getDocumentWithVersions(documentEnvelopeId);
    if (!doc || doc.envelope.workspaceId !== workspaceId) {
      throw new Error('Access denied');
    }

    await publishDocument(documentEnvelopeId, versionId, makeSearchable);

    logger.info('Document published', {
      documentEnvelopeId,
      versionId,
      makeSearchable,
      workspaceId,
      userId,
    });

    revalidateDocumentPaths(workspaceId, documentEnvelopeId);
    return { success: true };
  } catch (error) {
    logger.error('Failed to publish document', {
      documentEnvelopeId,
      versionId,
      workspaceId,
      error,
    });
    throw error;
  }
}

/**
 * Unpublish a document
 */
export async function unpublishDocumentAction(
  documentEnvelopeId: string,
  workspaceId: string,
) {
  const { userId } = await auth();

  if (!userId) {
    throw new Error('Unauthorized');
  }

  try {
    // Security: Verify user has access to this document's workspace
    const doc = await getDocumentWithVersions(documentEnvelopeId);
    if (!doc || doc.envelope.workspaceId !== workspaceId) {
      throw new Error('Access denied');
    }

    await unpublishDocument(documentEnvelopeId);

    logger.info('Document unpublished', {
      documentEnvelopeId,
      workspaceId,
      userId,
    });

    revalidateDocumentPaths(workspaceId, documentEnvelopeId);
    return { success: true };
  } catch (error) {
    logger.error('Failed to unpublish document', {
      documentEnvelopeId,
      workspaceId,
      error,
    });
    throw error;
  }
}

/**
 * Toggle document searchable state (RAG indexing)
 */
export async function toggleDocumentSearchableAction(
  documentEnvelopeId: string,
  workspaceId: string,
) {
  const { userId } = await auth();

  if (!userId) {
    throw new Error('Unauthorized');
  }

  try {
    // Security: Verify user has access to this document's workspace
    const doc = await getDocumentWithVersions(documentEnvelopeId);
    if (!doc || doc.envelope.workspaceId !== workspaceId) {
      throw new Error('Access denied');
    }

    const isSearchable = await toggleDocumentSearchable(documentEnvelopeId);

    logger.info('Document searchable toggled', {
      documentEnvelopeId,
      workspaceId,
      isSearchable,
      userId,
    });

    revalidateDocumentPaths(workspaceId, documentEnvelopeId);
    return { success: true, isSearchable };
  } catch (error) {
    logger.error('Failed to toggle document searchable', {
      documentEnvelopeId,
      workspaceId,
      error,
    });
    throw error;
  }
}

/**
 * Auto-save document draft changes
 * Hybrid approach: uses messageId if available from document context, null for standalone edits
 */
export async function autoSaveDocumentDraftAction(
  documentEnvelopeId: string,
  content: string,
  workspaceId: string,
  messageId?: string | null,
) {
  const { userId } = await auth();

  if (!userId) {
    throw new Error('Unauthorized');
  }

  try {
    // Security: Verify user has access to this document's workspace
    const doc = await getDocumentWithVersions(documentEnvelopeId);
    if (!doc || doc.envelope.workspaceId !== workspaceId) {
      throw new Error('Access denied');
    }

    // Use provided messageId if available, otherwise null (standalone edit)
    const effectiveMessageId = messageId !== undefined ? messageId : null;

    const version = await saveDocumentDraft({
      documentEnvelopeId,
      content,
      messageId: effectiveMessageId,
      workspaceId,
      userId,
    });

    logger.debug('Document draft auto-saved', {
      documentEnvelopeId,
      versionId: version.id,
      versionNumber: version.versionNumber,
      workspaceId,
      userId,
      hasMessageId: !!effectiveMessageId,
    });

    // Revalidate Next.js cache so server-rendered pages show updates
    revalidateDocumentPaths(workspaceId, documentEnvelopeId);

    return { success: true, versionId: version.id };
  } catch (error) {
    logger.error('Failed to auto-save document draft', {
      documentEnvelopeId,
      workspaceId,
      error,
    });
    throw error;
  }
}

/**
 * Create standalone draft from published document (for editing)
 */
export async function editPublishedDocumentAction(
  documentEnvelopeId: string,
  workspaceId: string,
) {
  const { userId } = await auth();

  if (!userId) {
    throw new Error('Unauthorized');
  }

  try {
    // Security: Verify user has access to this document's workspace
    const doc = await getDocumentWithVersions(documentEnvelopeId);
    if (!doc || doc.envelope.workspaceId !== workspaceId) {
      throw new Error('Access denied');
    }

    const draft = await getOrCreateStandaloneDraft(
      documentEnvelopeId,
      workspaceId,
      userId,
    );

    logger.info('Standalone draft created/retrieved', {
      documentEnvelopeId,
      draftId: draft.id,
      workspaceId,
      userId,
    });

    return { success: true, draftId: draft.id };
  } catch (error) {
    logger.error('Failed to create standalone draft', {
      documentEnvelopeId,
      workspaceId,
      error,
    });
    throw error;
  }
}

/**
 * Discard standalone draft
 */
export async function discardStandaloneDraftAction(
  documentEnvelopeId: string,
  workspaceId: string,
) {
  const { userId } = await auth();

  if (!userId) {
    throw new Error('Unauthorized');
  }

  try {
    // Security: Verify user has access to this document's workspace
    const doc = await getDocumentWithVersions(documentEnvelopeId);
    if (!doc || doc.envelope.workspaceId !== workspaceId) {
      throw new Error('Access denied');
    }

    await discardStandaloneDraft(documentEnvelopeId);

    logger.info('Standalone draft discarded', {
      documentEnvelopeId,
      workspaceId,
      userId,
    });

    revalidateDocumentPaths(workspaceId, documentEnvelopeId);
    return { success: true };
  } catch (error) {
    logger.error('Failed to discard standalone draft', {
      documentEnvelopeId,
      workspaceId,
      error,
    });
    throw error;
  }
}

/**
 * Update document content (deprecated - for backward compat)
 */
export async function updateDocumentContentAction(
  documentId: string,
  content: string,
  workspaceId: string,
) {
  const { userId } = await auth();
  if (!userId) throw new Error('Unauthorized');

  // DEPRECATED: Use autoSaveDocumentDraftAction instead
  throw new Error(
    'updateDocumentContentAction is deprecated. Use autoSaveDocumentDraftAction with envelope/version schema.',
  );
}

/**
 * Delete document (deprecated - for backward compat)
 * DEPRECATED: Document deletion should now delete the envelope and all versions via cascade
 */
export async function deleteDocumentAction(
  documentId: string,
  workspaceId: string,
) {
  const { userId } = await auth();
  if (!userId) throw new Error('Unauthorized');

  throw new Error(
    'deleteDocumentAction is deprecated. Implement envelope deletion if needed.',
  );
}

/**
 * Update published document - creates and immediately publishes a new version
 * Used by document edit page (/workspace/.../document/.../edit)
 * This is different from auto-save which creates drafts
 */
export async function updatePublishedDocumentAction(
  documentEnvelopeId: string,
  content: string,
  workspaceId: string,
) {
  const { userId } = await auth();

  if (!userId) {
    throw new Error('Unauthorized');
  }

  try {
    // Security: Verify user has access to this document's workspace
    const doc = await getDocumentWithVersions(documentEnvelopeId);
    if (!doc || doc.envelope.workspaceId !== workspaceId) {
      throw new Error('Access denied');
    }

    // Verify there's a published version (this route only edits published docs)
    if (!doc.currentPublished) {
      throw new Error('No published version to edit');
    }

    // Create a new draft version
    const newVersion = await saveDocumentDraft({
      documentEnvelopeId,
      content,
      messageId: null, // Standalone edit, no message
      workspaceId,
      userId,
    });

    // Immediately publish it (keeping searchable state)
    await publishDocument(
      documentEnvelopeId,
      newVersion.id,
      doc.envelope.isSearchable,
    );

    logger.info('Published document updated', {
      documentEnvelopeId,
      versionId: newVersion.id,
      workspaceId,
      userId,
    });

    // Revalidate Next.js cache so server-rendered pages show updates
    revalidateDocumentPaths(workspaceId, documentEnvelopeId);

    return { success: true, versionId: newVersion.id };
  } catch (error) {
    logger.error('Failed to update published document', {
      documentEnvelopeId,
      workspaceId,
      error,
    });
    throw error;
  }
}

/**
 * Quick publish - publishes active draft with default settings (searchable=true)
 * Used by QuickPublishButton in document preview
 */
export async function quickPublishDocumentAction(
  documentEnvelopeId: string,
  workspaceId: string,
) {
  const { userId } = await auth();

  if (!userId) {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    // Get document with versions
    const doc = await getDocumentWithVersions(documentEnvelopeId);

    // Security: Verify access
    if (!doc || doc.envelope.workspaceId !== workspaceId) {
      return { success: false, error: 'Access denied' };
    }

    // Check if there's a draft to publish
    if (!doc.currentDraft) {
      return { success: false, error: 'No draft version found' };
    }

    // Check if already published
    if (doc.currentPublished) {
      return { success: false, error: 'Document already published' };
    }

    // Publish with default settings (makeSearchable=true)
    await publishDocument(documentEnvelopeId, doc.currentDraft.id, true);

    logger.info('Document quick-published', {
      documentEnvelopeId,
      versionId: doc.currentDraft.id,
      workspaceId,
      userId,
    });

    revalidateDocumentPaths(workspaceId, documentEnvelopeId);
    return { success: true };
  } catch (error) {
    logger.error('Failed to quick-publish document', {
      documentEnvelopeId,
      workspaceId,
      error,
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to publish',
    };
  }
}
