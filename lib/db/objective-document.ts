import 'server-only';

import { and, desc, eq, isNull } from 'drizzle-orm';
import { db } from './queries';
import {
  chat,
  objective,
  objectiveDocument,
  objectiveDocumentVersion,
  workspace,
} from './schema';
import type {
  ObjectiveDocument,
  ObjectiveDocumentVersion,
  Objective,
} from './schema';
import { ChatSDKError } from '@/lib/errors';

export type { ObjectiveDocument, ObjectiveDocumentVersion };

export interface ObjectiveDocumentWithVersions {
  document: ObjectiveDocument;
  versions: ObjectiveDocumentVersion[];
  latestVersion?: ObjectiveDocumentVersion;
}

export async function createObjectiveDocument(
  objectiveId: string,
  workspaceId: string,
  userId: string,
  data: { title: string; content: string },
): Promise<{ document: ObjectiveDocument; version: ObjectiveDocumentVersion }> {
  try {
    // Use transaction to ensure all 3 steps succeed or rollback
    const result = await db.transaction(async (tx) => {
      // 1. Create ObjectiveDocument
      const [document] = await tx
        .insert(objectiveDocument)
        .values({
          workspaceId,
          title: data.title,
          createdByUserId: userId,
        })
        .returning();

      // 2. Create first ObjectiveDocumentVersion
      const [version] = await tx
        .insert(objectiveDocumentVersion)
        .values({
          documentId: document.id,
          content: data.content,
          createdByUserId: userId,
        })
        .returning();

      // 3. Update Objective.objectiveDocumentId
      await tx
        .update(objective)
        .set({ objectiveDocumentId: document.id })
        .where(eq(objective.id, objectiveId));

      return { document, version };
    });

    return result;
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to create objective document',
    );
  }
}

export async function createDocumentVersion(
  documentId: string,
  userId: string,
  data: {
    content?: string;
    punchlist?: string;
    metadata?: Record<string, unknown>;
  },
): Promise<ObjectiveDocumentVersion> {
  try {
    // Get latest version to copy content and punchlist (if not provided in data)
    const [latestVersion] = await db
      .select({
        content: objectiveDocumentVersion.content,
        punchlist: objectiveDocumentVersion.punchlist,
      })
      .from(objectiveDocumentVersion)
      .where(eq(objectiveDocumentVersion.documentId, documentId))
      .orderBy(desc(objectiveDocumentVersion.createdAt))
      .limit(1);

    // Create new version - copy content and punchlist from latest if not provided
    const [version] = await db
      .insert(objectiveDocumentVersion)
      .values({
        documentId,
        content: data.content ?? latestVersion?.content ?? '',
        punchlist: data.punchlist ?? latestVersion?.punchlist ?? null,
        metadata: data.metadata,
        createdByUserId: userId,
      })
      .returning();

    // Update document's updatedAt timestamp
    await db
      .update(objectiveDocument)
      .set({ updatedAt: new Date() })
      .where(eq(objectiveDocument.id, documentId));

    return version;
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to create document version',
    );
  }
}

export async function getDocumentByObjectiveId(
  objectiveId: string,
): Promise<ObjectiveDocumentWithVersions | null> {
  try {
    // Get objective's objectiveDocumentId
    const [obj] = await db
      .select()
      .from(objective)
      .where(eq(objective.id, objectiveId))
      .limit(1);

    if (!obj || !obj.objectiveDocumentId) {
      return null;
    }

    // Get document
    const [document] = await db
      .select()
      .from(objectiveDocument)
      .where(eq(objectiveDocument.id, obj.objectiveDocumentId))
      .limit(1);

    if (!document) {
      return null;
    }

    // Get all versions
    const versions = await db
      .select()
      .from(objectiveDocumentVersion)
      .where(eq(objectiveDocumentVersion.documentId, document.id))
      .orderBy(desc(objectiveDocumentVersion.createdAt));

    // Latest version is first after ordering by createdAt DESC
    const latestVersion = versions[0];

    return {
      document,
      versions,
      latestVersion,
    };
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get document by objective',
    );
  }
}

export async function getLatestVersion(
  documentId: string,
): Promise<ObjectiveDocumentVersion | null> {
  try {
    const [version] = await db
      .select()
      .from(objectiveDocumentVersion)
      .where(eq(objectiveDocumentVersion.documentId, documentId))
      .orderBy(desc(objectiveDocumentVersion.createdAt))
      .limit(1);

    return version || null;
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get latest version',
    );
  }
}

/**
 * Get all objective documents in workspace with their latest versions
 * Optionally filter by objectiveId
 */
export async function getAllObjectiveDocumentsByWorkspaceId(
  workspaceId: string,
  userId: string,
  filterObjectiveId?: string,
): Promise<
  Array<{
    document: ObjectiveDocument;
    latestVersion: ObjectiveDocumentVersion | null;
    objective: Objective | null;
  }>
> {
  try {
    // Get all objectives that match the filter (if provided)
    const objectiveWhere = filterObjectiveId
      ? and(
          eq(objective.workspaceId, workspaceId),
          eq(objective.id, filterObjectiveId),
        )
      : eq(objective.workspaceId, workspaceId);

    const objectives = await db.select().from(objective).where(objectiveWhere);

    // Get only document IDs linked to filtered objectives
    const filteredDocumentIds = new Set(
      objectives
        .map((obj) => obj.objectiveDocumentId)
        .filter((id): id is string => id !== null),
    );

    // If filtering by objective and no documents found, return empty
    if (filterObjectiveId && filteredDocumentIds.size === 0) {
      return [];
    }

    // Get all documents in workspace with ownership verification
    const documentWhere = filterObjectiveId
      ? and(
          eq(objectiveDocument.workspaceId, workspaceId),
          eq(workspace.userId, userId),
          isNull(workspace.deletedAt),
        )
      : and(
          eq(objectiveDocument.workspaceId, workspaceId),
          eq(workspace.userId, userId),
          isNull(workspace.deletedAt),
        );

    const documents = await db
      .select({ objectiveDocument })
      .from(objectiveDocument)
      .innerJoin(workspace, eq(objectiveDocument.workspaceId, workspace.id))
      .where(documentWhere)
      .orderBy(desc(objectiveDocument.updatedAt));

    // Create objective lookup map
    const objectiveMap = new Map(
      objectives.map((obj) => [obj.objectiveDocumentId, obj]),
    );

    // Filter documents to only those linked to filtered objectives (if filtering)
    const filteredDocuments = filterObjectiveId
      ? documents.filter(({ objectiveDocument: doc }) =>
          filteredDocumentIds.has(doc.id),
        )
      : documents;

    // For each document, get its latest version
    const results = await Promise.all(
      filteredDocuments.map(async ({ objectiveDocument: doc }) => {
        const [latestVersion] = await db
          .select()
          .from(objectiveDocumentVersion)
          .where(eq(objectiveDocumentVersion.documentId, doc.id))
          .orderBy(desc(objectiveDocumentVersion.createdAt))
          .limit(1);

        const linkedObjective = objectiveMap.get(doc.id) || null;

        return {
          document: doc,
          latestVersion: latestVersion || null,
          objective: linkedObjective,
        };
      }),
    );

    return results;
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get objective documents by workspace',
    );
  }
}

/**
 * Get a single objective document by ID
 */
export async function getObjectiveDocumentById(
  documentId: string,
): Promise<ObjectiveDocumentWithVersions | null> {
  try {
    const [document] = await db
      .select()
      .from(objectiveDocument)
      .where(eq(objectiveDocument.id, documentId))
      .limit(1);

    if (!document) {
      return null;
    }

    // Get all versions
    const versions = await db
      .select()
      .from(objectiveDocumentVersion)
      .where(eq(objectiveDocumentVersion.documentId, documentId))
      .orderBy(desc(objectiveDocumentVersion.createdAt));

    const latestVersion = versions[0];

    return {
      document,
      versions,
      latestVersion,
    };
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get objective document by id',
    );
  }
}

/**
 * Update objective document content by creating a new version
 * This is the primary way to edit objective documents (creates version history)
 */
export async function updateObjectiveDocumentContent(
  documentId: string,
  userId: string,
  content: string,
  metadata?: Record<string, unknown>,
): Promise<ObjectiveDocumentVersion> {
  try {
    // Create new version
    const newVersion = await createDocumentVersion(documentId, userId, {
      content,
      metadata,
    });

    return newVersion;
  } catch (error) {
    if (error instanceof ChatSDKError) {
      throw error;
    }
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to update objective document content',
    );
  }
}

/**
 * Delete an objective document and all its versions
 * Also nulls out the objectiveDocumentId on any linked objectives
 */
export async function deleteObjectiveDocument(
  documentId: string,
  userId: string,
): Promise<void> {
  try {
    // Verify ownership via workspace
    const [doc] = await db
      .select({ objectiveDocument })
      .from(objectiveDocument)
      .innerJoin(workspace, eq(objectiveDocument.workspaceId, workspace.id))
      .where(
        and(
          eq(objectiveDocument.id, documentId),
          eq(workspace.userId, userId),
          isNull(workspace.deletedAt),
        ),
      )
      .limit(1);

    if (!doc) {
      throw new ChatSDKError(
        'not_found:database',
        'Objective document not found or access denied',
      );
    }

    // Use transaction to ensure cleanup
    await db.transaction(async (tx) => {
      // 1. Delete all versions (cascade will handle this via FK, but explicit is safer)
      await tx
        .delete(objectiveDocumentVersion)
        .where(eq(objectiveDocumentVersion.documentId, documentId));

      // 2. Null out objectiveDocumentId on linked objectives (FK has SET NULL)
      await tx
        .update(objective)
        .set({ objectiveDocumentId: null })
        .where(eq(objective.objectiveDocumentId, documentId));

      // 3. Delete the document
      await tx
        .delete(objectiveDocument)
        .where(eq(objectiveDocument.id, documentId));
    });
  } catch (error) {
    if (error instanceof ChatSDKError) {
      throw error;
    }
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to delete objective document',
    );
  }
}

/**
 * Initialize a new version for a chat within an objective
 * Implements "one chat = one version" rule
 * Returns versionId, documentId, and whether this is the first version
 */
export async function initializeVersionForChat(
  chatId: string,
  objectiveId: string,
  userId: string,
  workspaceId: string,
): Promise<{ versionId: string; documentId: string; isFirstVersion: boolean }> {
  try {
    return await db.transaction(async (tx) => {
      // 1. Get objective's documentId
      const [obj] = await tx
        .select({ objectiveDocumentId: objective.objectiveDocumentId })
        .from(objective)
        .where(eq(objective.id, objectiveId))
        .limit(1);

      let documentId = obj?.objectiveDocumentId;
      let versionId: string;
      let isFirstVersion = false;

      // 2. Create document if none exists
      if (!documentId) {
        const result = await createObjectiveDocument(
          objectiveId,
          workspaceId,
          userId,
          {
            title: 'Draft Document',
            content: '',
          },
        );
        documentId = result.document.id;
        versionId = result.version.id;
        isFirstVersion = true;
      } else {
        // 3. Create new version (copies both content and punchlist from latest)
        const newVersion = await createDocumentVersion(documentId, userId, {});
        versionId = newVersion.id;
      }

      // 4. Link version to chat
      await tx
        .update(chat)
        .set({ objectiveDocumentVersionId: versionId })
        .where(eq(chat.id, chatId));

      return { versionId, documentId, isFirstVersion };
    });
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to initialize version for chat',
    );
  }
}

/**
 * Get version by chatId (for tool context)
 * Uses the new FK relationship where chat references version
 */
export async function getVersionByChatId(
  chatId: string,
): Promise<ObjectiveDocumentVersion | null> {
  try {
    const [result] = await db
      .select({
        version: objectiveDocumentVersion,
      })
      .from(chat)
      .innerJoin(
        objectiveDocumentVersion,
        eq(chat.objectiveDocumentVersionId, objectiveDocumentVersion.id),
      )
      .where(eq(chat.id, chatId))
      .limit(1);

    return result?.version || null;
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get version by chat',
    );
  }
}

/**
 * Update the punchlist field of an existing version
 * Used by punchlist generation to update tracking without creating a new version
 */
export async function updateVersionPunchlist(
  versionId: string,
  punchlist: string,
): Promise<void> {
  try {
    await db
      .update(objectiveDocumentVersion)
      .set({ punchlist })
      .where(eq(objectiveDocumentVersion.id, versionId));
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to update version punchlist',
    );
  }
}

/**
 * Update the content field of an existing version
 * Used by document generation to update content without creating a new version
 * Implements "one chat = one version" pattern
 */
export async function updateVersionContent(
  versionId: string,
  content: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  try {
    await db.transaction(async (tx) => {
      // 1. Update version content
      await tx
        .update(objectiveDocumentVersion)
        .set({
          content,
          metadata: metadata ?? undefined,
        })
        .where(eq(objectiveDocumentVersion.id, versionId));

      // 2. Get documentId to update document timestamp
      const [version] = await tx
        .select({ documentId: objectiveDocumentVersion.documentId })
        .from(objectiveDocumentVersion)
        .where(eq(objectiveDocumentVersion.id, versionId))
        .limit(1);

      if (version) {
        // 3. Update document's updatedAt timestamp
        await tx
          .update(objectiveDocument)
          .set({ updatedAt: new Date() })
          .where(eq(objectiveDocument.id, version.documentId));
      }
    });
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to update version content',
    );
  }
}
