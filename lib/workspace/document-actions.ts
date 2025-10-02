'use server';

import { auth } from '@clerk/nextjs/server';
import {
  toggleDocumentSearchable as dalToggle,
  softDeleteDocument as dalDelete,
  updateDocument as dalUpdate,
} from '@/lib/db/documents';
import { getLogger } from '@/lib/logger';

const logger = getLogger('DocumentActions');

/**
 * Toggle document searchable state (RAG indexing)
 */
export async function toggleDocumentSearchableAction(
  documentId: string,
  workspaceId: string,
  isSearchable: boolean,
) {
  const { userId } = await auth();

  if (!userId) {
    throw new Error('Unauthorized');
  }

  try {
    const result = await dalToggle(documentId, workspaceId, isSearchable);

    logger.info('Document searchable toggled', {
      documentId,
      workspaceId,
      isSearchable,
      userId,
    });

    return { success: true, document: result };
  } catch (error) {
    logger.error('Failed to toggle document searchable', {
      documentId,
      workspaceId,
      isSearchable,
      error,
    });
    throw error;
  }
}

/**
 * Soft delete document (sets deletedAt timestamp, removes from RAG)
 */
export async function deleteDocumentAction(
  documentId: string,
  workspaceId: string,
) {
  const { userId } = await auth();

  if (!userId) {
    throw new Error('Unauthorized');
  }

  try {
    const result = await dalDelete(documentId, workspaceId);

    logger.info('Document deleted', {
      documentId,
      workspaceId,
      userId,
    });

    return { success: true };
  } catch (error) {
    logger.error('Failed to delete document', {
      documentId,
      workspaceId,
      error,
    });
    throw error;
  }
}

/**
 * Update document content (for inline editing)
 */
export async function updateDocumentContentAction(
  documentId: string,
  workspaceId: string,
  content: string,
  title?: string,
) {
  const { userId } = await auth();

  if (!userId) {
    throw new Error('Unauthorized');
  }

  try {
    const updates = {
      content,
      ...(title && { title }),
    };

    const result = await dalUpdate(documentId, updates);

    logger.info('Document updated', {
      documentId,
      workspaceId,
      contentLength: content.length,
      userId,
    });

    return { success: true, document: result };
  } catch (error) {
    logger.error('Failed to update document', {
      documentId,
      workspaceId,
      error,
    });
    throw error;
  }
}
