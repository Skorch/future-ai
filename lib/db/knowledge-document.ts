import 'server-only';

import { and, desc, eq, isNull } from 'drizzle-orm';
import { db } from './queries';
import { knowledgeDocument, workspace } from './schema';
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
  },
): Promise<KnowledgeDocument> {
  try {
    const [document] = await db
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
        createdByUserId: userId,
      })
      .returning();

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
    const documents = await db
      .select()
      .from(knowledgeDocument)
      .where(eq(knowledgeDocument.objectiveId, objectiveId))
      .orderBy(desc(knowledgeDocument.createdAt));

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
): Promise<KnowledgeDocument[]> {
  try {
    const conditions = [eq(knowledgeDocument.workspaceId, workspaceId)];

    if (category) {
      conditions.push(eq(knowledgeDocument.category, category));
    }

    const documents = await db
      .select()
      .from(knowledgeDocument)
      .where(and(...conditions))
      .orderBy(desc(knowledgeDocument.createdAt));

    return documents;
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get knowledge by workspace',
    );
  }
}

export async function deleteKnowledgeDocument(
  knowledgeId: string,
  userId: string,
): Promise<void> {
  try {
    // Verify ownership via workspace
    const [doc] = await db
      .select({ knowledgeDocument })
      .from(knowledgeDocument)
      .innerJoin(workspace, eq(knowledgeDocument.workspaceId, workspace.id))
      .where(
        and(
          eq(knowledgeDocument.id, knowledgeId),
          eq(workspace.userId, userId),
          isNull(workspace.deletedAt),
        ),
      )
      .limit(1);

    if (!doc) {
      throw new ChatSDKError(
        'not_found:database',
        'Knowledge document not found or access denied',
      );
    }

    await db
      .delete(knowledgeDocument)
      .where(eq(knowledgeDocument.id, knowledgeId));
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
