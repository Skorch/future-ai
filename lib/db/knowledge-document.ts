// STUB: Real implementation in Phase 2
// This file contains type definitions and stub functions for KnowledgeDocument entity
// These will be replaced with real implementations connecting to the database

export type KnowledgeCategory = 'knowledge' | 'raw';

export interface KnowledgeDocument {
  id: string;
  objectiveId?: string;
  workspaceId: string;
  title: string;
  content: string;
  category: KnowledgeCategory;
  documentType: string;
  isSearchable: boolean;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  createdByUserId: string;
}

export async function createKnowledgeDocument(
  workspaceId: string,
  userId: string,
  data: {
    objectiveId?: string;
    title: string;
    content: string;
    category: KnowledgeCategory;
    documentType: string;
    metadata?: Record<string, unknown>;
  },
): Promise<KnowledgeDocument> {
  throw new Error('STUB: Implement in Phase 2');
}

export async function getKnowledgeByObjectiveId(
  objectiveId: string,
): Promise<KnowledgeDocument[]> {
  return []; // STUB: Implement in Phase 2
}

export async function getKnowledgeByWorkspaceId(
  workspaceId: string,
  category?: KnowledgeCategory,
): Promise<KnowledgeDocument[]> {
  return []; // STUB: Implement in Phase 2
}

export async function deleteKnowledgeDocument(
  knowledgeId: string,
  userId: string,
): Promise<void> {
  throw new Error('STUB: Implement in Phase 2');
}
