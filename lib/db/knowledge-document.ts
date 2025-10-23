import 'server-only';

import { and, desc, eq } from 'drizzle-orm';
import { db } from './queries';
import { knowledgeDocument } from './schema';
import type { KnowledgeDocument } from './schema';
import { ChatSDKError } from '@/lib/errors';

export type { KnowledgeDocument };
export type KnowledgeCategory = 'knowledge' | 'raw';

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
    // Phase 3: Source metadata fields
    sourceType?: 'transcript' | 'email' | 'slack' | 'note';
    sourceDate?: Date;
    participants?: Array<{
      email?: string;
      displayName: string;
    }>;
    sourceKnowledgeDocumentId?: string;
  },
): Promise<KnowledgeDocument> {
  try {
    const result = await db
      .insert(knowledgeDocument)
      .values({
        workspaceId,
        objectiveId: data.objectiveId,
        title: data.title,
        content: data.content,
        category: data.category,
        documentType: data.documentType,
        isSearchable: true, // Default to searchable
        metadata: data.metadata,
        // Phase 3: Set source metadata
        sourceType: data.sourceType,
        sourceDate: data.sourceDate,
        participants: data.participants,
        sourceKnowledgeDocumentId: data.sourceKnowledgeDocumentId,
        createdByUserId: userId,
      })
      .returning();

    const [document] = result as KnowledgeDocument[];

    if (!document) {
      throw new Error('No document returned from insert');
    }

    return document;
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to create knowledge document',
    );
  }
}

export async function getKnowledgeByObjectiveId(
  objectiveId: string,
): Promise<KnowledgeDocument[]> {
  try {
    const documents = (await db
      .select()
      .from(knowledgeDocument)
      .where(eq(knowledgeDocument.objectiveId, objectiveId))
      .orderBy(desc(knowledgeDocument.createdAt))) as KnowledgeDocument[];

    return documents;
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get knowledge by objective',
    );
  }
}

export async function getKnowledgeByWorkspaceId(
  workspaceId: string,
  category?: KnowledgeCategory,
  filterObjectiveId?: string,
): Promise<KnowledgeDocument[]> {
  try {
    const conditions = [eq(knowledgeDocument.workspaceId, workspaceId)];

    if (category) {
      conditions.push(eq(knowledgeDocument.category, category));
    }

    if (filterObjectiveId) {
      conditions.push(eq(knowledgeDocument.objectiveId, filterObjectiveId));
    }

    const documents = (await db
      .select()
      .from(knowledgeDocument)
      .where(and(...conditions))
      .orderBy(desc(knowledgeDocument.createdAt))) as KnowledgeDocument[];

    return documents;
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get knowledge by workspace',
    );
  }
}

export async function getKnowledgeDocumentById(
  id: string,
): Promise<KnowledgeDocument | null> {
  try {
    const [doc] = await db
      .select()
      .from(knowledgeDocument)
      .where(eq(knowledgeDocument.id, id))
      .limit(1);

    return (doc as KnowledgeDocument) || null;
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get knowledge document by id',
    );
  }
}

/**
 * Get knowledge document by source knowledge document ID
 * Returns the most recent summary created from a given raw document
 */
export async function getKnowledgeDocumentBySourceId(
  sourceKnowledgeDocumentId: string,
  objectiveId: string,
): Promise<KnowledgeDocument | null> {
  try {
    const [doc] = await db
      .select()
      .from(knowledgeDocument)
      .where(
        and(
          eq(
            knowledgeDocument.sourceKnowledgeDocumentId,
            sourceKnowledgeDocumentId,
          ),
          eq(knowledgeDocument.objectiveId, objectiveId),
        ),
      )
      .orderBy(desc(knowledgeDocument.createdAt))
      .limit(1);

    return (doc as KnowledgeDocument) || null;
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get knowledge document by source id',
    );
  }
}

export async function updateKnowledgeDocument(
  id: string,
  data: {
    title?: string;
    content?: string;
    metadata?: Record<string, unknown>;
    isSearchable?: boolean;
  },
): Promise<KnowledgeDocument> {
  try {
    const result = await db
      .update(knowledgeDocument)
      .set(data)
      .where(eq(knowledgeDocument.id, id))
      .returning();

    const [updated] = result as KnowledgeDocument[];

    if (!updated) {
      throw new ChatSDKError(
        'not_found:database',
        'Knowledge document not found',
      );
    }

    return updated;
  } catch (error) {
    if (error instanceof ChatSDKError) {
      throw error;
    }
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to update knowledge document',
    );
  }
}

export async function deleteKnowledgeDocument(
  knowledgeId: string,
): Promise<void> {
  try {
    const result = await db
      .delete(knowledgeDocument)
      .where(eq(knowledgeDocument.id, knowledgeId))
      .returning();

    if (!result.length) {
      throw new ChatSDKError(
        'not_found:database',
        'Knowledge document not found',
      );
    }
  } catch (error) {
    if (error instanceof ChatSDKError) {
      throw error;
    }
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to delete knowledge document',
    );
  }
}
