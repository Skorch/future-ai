// STUB: Real implementation in Phase 2
// This file contains type definitions and stub functions for ObjectiveDocument entity
// These will be replaced with real implementations connecting to the database

export interface ObjectiveDocument {
  id: string;
  workspaceId: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  createdByUserId: string;
}

export interface ObjectiveDocumentVersion {
  id: string;
  documentId: string;
  chatId?: string;
  content: string;
  metadata?: Record<string, unknown>;
  versionNumber: number;
  createdAt: Date;
  createdByUserId: string;
}

export interface ObjectiveDocumentWithVersions {
  document: ObjectiveDocument;
  versions: ObjectiveDocumentVersion[];
  latestVersion?: ObjectiveDocumentVersion;
}

export async function createObjectiveDocument(
  objectiveId: string,
  workspaceId: string,
  userId: string,
  data: { title: string; content: string; chatId?: string },
): Promise<{ document: ObjectiveDocument; version: ObjectiveDocumentVersion }> {
  throw new Error('STUB: Implement in Phase 2');
  // Will also update Objective.objectiveDocumentId
}

export async function createDocumentVersion(
  documentId: string,
  chatId: string,
  userId: string,
  data: { content: string; metadata?: Record<string, unknown> },
): Promise<ObjectiveDocumentVersion> {
  throw new Error('STUB: Implement in Phase 2');
}

export async function getDocumentByObjectiveId(
  objectiveId: string,
): Promise<ObjectiveDocumentWithVersions | null> {
  return null; // STUB: Implement in Phase 2
  // Will look up Objective.objectiveDocumentId and fetch document
}

export async function getLatestVersion(
  documentId: string,
): Promise<ObjectiveDocumentVersion | null> {
  return null; // STUB: Implement in Phase 2
}

export async function deleteVersionsByChatId(chatId: string): Promise<void> {
  throw new Error('STUB: Implement in Phase 2');
}
