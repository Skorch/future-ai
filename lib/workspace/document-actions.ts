// STUB FILE: Phase 1 - Build compatibility only
// This file exports stub functions to satisfy imports while Phase 2-3 are in progress
// All functions throw errors at runtime

'use server';

export async function toggleDocumentSearchableAction(
  _documentId: string,
  _workspaceId?: string,
): Promise<void> {
  throw new Error(
    'STUB: Phase 1 - toggleDocumentSearchableAction not implemented',
  );
}

export async function deleteDocumentAction(
  _documentId: string,
  _workspaceId?: string,
): Promise<void> {
  throw new Error('STUB: Phase 1 - deleteDocumentAction not implemented');
}

export async function updatePublishedDocumentAction(
  _documentId: string,
  _content: string,
  _workspaceId?: string,
): Promise<void> {
  throw new Error(
    'STUB: Phase 1 - updatePublishedDocumentAction not implemented',
  );
}

export async function autoSaveDocumentDraftAction(
  _documentId: string,
  _content: string,
  _chatId?: string,
): Promise<void> {
  throw new Error(
    'STUB: Phase 1 - autoSaveDocumentDraftAction not implemented',
  );
}

export async function publishDocumentAction(
  _documentId: string,
): Promise<void> {
  throw new Error('STUB: Phase 1 - publishDocumentAction not implemented');
}

export async function unpublishDocumentAction(
  _documentId: string,
): Promise<void> {
  throw new Error('STUB: Phase 1 - unpublishDocumentAction not implemented');
}

export async function quickPublishDocumentAction(
  _documentId: string,
  _content: string,
): Promise<void> {
  throw new Error('STUB: Phase 1 - quickPublishDocumentAction not implemented');
}
