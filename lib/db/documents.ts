// STUB FILE: Phase 1 - Build compatibility only
// This file exports stub functions to satisfy imports while Phase 2-3 are in progress
// All functions throw errors at runtime

// Stub types - Phase 2 will use proper ObjectiveDocument types
// These match the old DocumentEnvelope/DocumentVersion structure to satisfy TypeScript

type StubDocumentEnvelope = {
  id: string;
  title: string;
  documentType: string;
  workspaceId: string;
  createdByUserId: string;
  createdAt: Date;
  updatedAt: Date;
  isSearchable: boolean;
  activeDraftVersionId: string | null;
  activePublishedVersionId: string | null;
};

type StubDocumentVersion = {
  id: string;
  documentId: string;
  content: string;
  kind: string;
  versionNumber: number;
  createdAt: Date;
  createdByUserId: string;
  chatId: string | null;
  metadata: Record<string, unknown> | null;
  workspaceId: string;
};

type StubDocumentWithVersions = {
  envelope: StubDocumentEnvelope;
  currentDraft: StubDocumentVersion | null;
  currentPublished: StubDocumentVersion | null;
  allVersions?: StubDocumentVersion[];
};

export async function getDocumentWithVersions(
  _documentId: string,
): Promise<StubDocumentWithVersions | null> {
  throw new Error('STUB: Phase 1 - getDocumentWithVersions not implemented');
}

export async function cleanOrphanedVersions(
  _workspaceId: string,
): Promise<void> {
  throw new Error('STUB: Phase 1 - cleanOrphanedVersions not implemented');
}

export async function updateDocumentVersionsMessageId(
  _updates: Array<{ versionId: string; messageId: string }>,
): Promise<void> {
  throw new Error(
    'STUB: Phase 1 - updateDocumentVersionsMessageId not implemented',
  );
}

// Stub type for pagination response
type StubPaginatedResponse = {
  documents: (StubDocumentEnvelope & {
    activeDraftVersion: StubDocumentVersion | null;
    activePublishedVersion: StubDocumentVersion | null;
  })[];
  total: number;
  hasMore: boolean;
};

export async function getWorkspaceDocumentsPaginated(_params: {
  workspaceId: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: string;
  order?: string;
  cursor?: string;
  search?: string;
  type?: string;
}): Promise<StubPaginatedResponse> {
  throw new Error(
    'STUB: Phase 1 - getWorkspaceDocumentsPaginated not implemented',
  );
}

export async function getDocumentById(
  _documentId: string,
  _workspaceId: string,
): Promise<
  | (StubDocumentEnvelope & {
      activeDraftVersion: StubDocumentVersion | null;
      activePublishedVersion: StubDocumentVersion | null;
    })
  | null
> {
  throw new Error('STUB: Phase 1 - getDocumentById not implemented');
}

export async function saveDocument(
  _documentId: string,
  _content: string,
): Promise<StubDocumentVersion> {
  throw new Error('STUB: Phase 1 - saveDocument not implemented');
}

// Stub type for document creation data
type StubCreateDocumentData = {
  id?: string;
  title: string;
  content: string;
  workspaceId: string;
  userId: string;
  documentType?: string;
  kind?: string;
  messageId?: string | null;
  chatId?: string | null;
  metadata?: Record<string, unknown>;
};

export async function createDocument(_data: StubCreateDocumentData): Promise<{
  envelope: StubDocumentEnvelope;
  currentDraft: StubDocumentVersion;
  currentPublished: null;
}> {
  throw new Error('STUB: Phase 1 - createDocument not implemented');
}

export async function publishDocument(
  _documentId: string,
  _versionId: string,
  _makeSearchable?: boolean,
): Promise<void> {
  throw new Error('STUB: Phase 1 - publishDocument not implemented');
}

export async function getPublishedDocumentById(
  _documentId: string,
  _workspaceId: string,
): Promise<
  | (StubDocumentEnvelope & {
      activePublishedVersion: StubDocumentVersion;
    })
  | null
> {
  throw new Error('STUB: Phase 1 - getPublishedDocumentById not implemented');
}

export async function getAllWorkspaceDocuments(_workspaceId: string): Promise<
  (StubDocumentEnvelope & {
    activeDraftVersion: StubDocumentVersion | null;
    activePublishedVersion: StubDocumentVersion | null;
  })[]
> {
  return []; // STUB: Empty array to satisfy imports
}

export async function getPublishedDocumentsByIds(
  _documentIds: string[],
  _workspaceId: string,
): Promise<
  (StubDocumentEnvelope & {
    activePublishedVersion: StubDocumentVersion;
  })[]
> {
  return []; // STUB: Empty array to satisfy imports
}

export async function getAllVersionsForDocument(
  _documentId: string,
): Promise<StubDocumentVersion[]> {
  return []; // STUB: Empty array to satisfy imports
}

export async function getPublishedDocuments(_workspaceId: string): Promise<
  (StubDocumentEnvelope & {
    activePublishedVersion: StubDocumentVersion;
  })[]
> {
  return []; // STUB: Empty array to satisfy imports
}
