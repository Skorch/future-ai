'use server';

import { auth } from '@clerk/nextjs/server';
import {
  publishDocument,
  unpublishDocument,
  toggleDocumentSearchable,
  discardStandaloneDraft,
  getDocumentWithVersions,
  getOrCreateStandaloneDraft,
} from '@/lib/db/documents';
import { getLogger } from '@/lib/logger';
import { revalidatePath } from 'next/cache';

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

    revalidatePath(`/workspace/${workspaceId}/document`);
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

    revalidatePath(`/workspace/${workspaceId}/document`);
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

    revalidatePath(`/workspace/${workspaceId}/document`);
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

    revalidatePath(`/workspace/${workspaceId}/document/${documentEnvelopeId}`);
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
  const { updateDocument } = await import('@/lib/db/documents-deprecated');
  const { userId } = await auth();
  if (!userId) throw new Error('Unauthorized');

  await updateDocument(documentId, { content });
  revalidatePath(`/workspace/${workspaceId}/document`);
  return { success: true };
}

/**
 * Delete document (deprecated - for backward compat)
 */
export async function deleteDocumentAction(
  documentId: string,
  workspaceId: string,
) {
  const { softDeleteDocument } = await import('@/lib/db/documents-deprecated');
  const { userId } = await auth();
  if (!userId) throw new Error('Unauthorized');

  await softDeleteDocument(documentId, workspaceId);
  revalidatePath(`/workspace/${workspaceId}/document`);
  return { success: true };
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

    revalidatePath(`/workspace/${workspaceId}/document`);
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
