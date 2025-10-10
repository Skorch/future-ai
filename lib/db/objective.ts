import 'server-only';

import { and, desc, eq, isNull } from 'drizzle-orm';
import { db } from './queries';
import { objective, workspace } from './schema';
import type { Objective } from './schema';
import { getDomain } from '@/lib/domains';
import { ChatSDKError } from '@/lib/errors';

export type { Objective };

export async function createObjective(
  workspaceId: string,
  userId: string,
  data: { title: string; description?: string },
): Promise<Objective> {
  try {
    // Get workspace to inherit documentType from domain
    const [ws] = await db
      .select()
      .from(workspace)
      .where(
        and(
          eq(workspace.id, workspaceId),
          eq(workspace.userId, userId),
          isNull(workspace.deletedAt),
        ),
      )
      .limit(1);

    if (!ws) {
      throw new ChatSDKError(
        'not_found:database',
        'Workspace not found or access denied',
      );
    }

    const domain = getDomain(ws.domainId);
    const documentType = domain.defaultDocumentType;

    const [newObjective] = await db
      .insert(objective)
      .values({
        workspaceId,
        title: data.title,
        description: data.description,
        documentType,
        status: 'open',
        createdByUserId: userId,
      })
      .returning();

    return newObjective;
  } catch (error) {
    if (error instanceof ChatSDKError) {
      throw error;
    }
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to create objective',
    );
  }
}

export async function getObjectivesByWorkspaceId(
  workspaceId: string,
  includePublished = false,
): Promise<Objective[]> {
  try {
    const conditions = [eq(objective.workspaceId, workspaceId)];

    if (!includePublished) {
      conditions.push(eq(objective.status, 'open'));
    }

    const objectives = await db
      .select()
      .from(objective)
      .where(and(...conditions))
      .orderBy(objective.createdAt);

    return objectives;
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get objectives by workspace',
    );
  }
}

export async function getObjectiveById(
  objectiveId: string,
  userId: string,
): Promise<Objective | null> {
  try {
    const [obj] = await db
      .select({ objective })
      .from(objective)
      .innerJoin(workspace, eq(objective.workspaceId, workspace.id))
      .where(
        and(
          eq(objective.id, objectiveId),
          eq(workspace.userId, userId),
          isNull(workspace.deletedAt),
        ),
      )
      .limit(1);

    return obj?.objective || null;
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get objective by id',
    );
  }
}

export async function updateObjective(
  objectiveId: string,
  userId: string,
  data: { title?: string; description?: string },
): Promise<Objective> {
  try {
    // Verify ownership via workspace
    const existing = await getObjectiveById(objectiveId, userId);
    if (!existing) {
      throw new ChatSDKError(
        'not_found:database',
        'Objective not found or access denied',
      );
    }

    const [updated] = await db
      .update(objective)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(objective.id, objectiveId))
      .returning();

    return updated;
  } catch (error) {
    if (error instanceof ChatSDKError) {
      throw error;
    }
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to update objective',
    );
  }
}

export async function publishObjective(
  objectiveId: string,
  userId: string,
): Promise<void> {
  try {
    // Verify ownership via workspace
    const obj = await getObjectiveById(objectiveId, userId);
    if (!obj) {
      throw new ChatSDKError(
        'not_found:database',
        'Objective not found or access denied',
      );
    }

    await db
      .update(objective)
      .set({
        status: 'published',
        publishedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(objective.id, objectiveId));
  } catch (error) {
    if (error instanceof ChatSDKError) {
      throw error;
    }
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to publish objective',
    );
  }
}

export async function unpublishObjective(
  objectiveId: string,
  userId: string,
): Promise<void> {
  try {
    // Verify ownership via workspace
    const obj = await getObjectiveById(objectiveId, userId);
    if (!obj) {
      throw new ChatSDKError(
        'not_found:database',
        'Objective not found or access denied',
      );
    }

    await db
      .update(objective)
      .set({
        status: 'open',
        publishedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(objective.id, objectiveId));
  } catch (error) {
    if (error instanceof ChatSDKError) {
      throw error;
    }
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to unpublish objective',
    );
  }
}

export async function deleteObjective(
  objectiveId: string,
  userId: string,
): Promise<void> {
  try {
    // Verify ownership via workspace
    const obj = await getObjectiveById(objectiveId, userId);
    if (!obj) {
      throw new ChatSDKError(
        'not_found:database',
        'Objective not found or access denied',
      );
    }

    // Delete objective (cascades to chats, but NOT to objective documents)
    await db.delete(objective).where(eq(objective.id, objectiveId));
  } catch (error) {
    if (error instanceof ChatSDKError) {
      throw error;
    }
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to delete objective',
    );
  }
}

export async function getOrCreateActiveObjective(
  workspaceId: string,
  userId: string,
): Promise<string> {
  try {
    // Find existing 'open' objective for this user/workspace
    const [existing] = await db
      .select({ id: objective.id })
      .from(objective)
      .where(
        and(
          eq(objective.workspaceId, workspaceId),
          eq(objective.status, 'open'),
          eq(objective.createdByUserId, userId),
        ),
      )
      .orderBy(desc(objective.createdAt))
      .limit(1);

    if (existing) return existing.id;

    // Create default objective
    const newObj = await createObjective(workspaceId, userId, {
      title: 'Active Objective',
      description: 'Auto-created for chat',
    });

    return newObj.id;
  } catch (error) {
    if (error instanceof ChatSDKError) {
      throw error;
    }
    throw new Error('Failed to get or create active objective');
  }
}
