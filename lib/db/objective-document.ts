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
    content: string;
    punchlist?: string;
    metadata?: Record<string, unknown>;
  },
): Promise<ObjectiveDocumentVersion> {
  try {
    // Get latest version to copy punchlist (if not provided in data)
    const [latestVersion] = await db
      .select({ punchlist: objectiveDocumentVersion.punchlist })
      .from(objectiveDocumentVersion)
      .where(eq(objectiveDocumentVersion.documentId, documentId))
      .orderBy(desc(objectiveDocumentVersion.createdAt))
      .limit(1);

    // Create new version
    const [version] = await db
      .insert(objectiveDocumentVersion)
      .values({
        documentId,
        content: data.content,
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
 */
export async function getAllObjectiveDocumentsByWorkspaceId(
  workspaceId: string,
  userId: string,
): Promise<
  Array<{
    document: ObjectiveDocument;
    latestVersion: ObjectiveDocumentVersion | null;
    objective: Objective | null;
  }>
> {
  try {
    // Get all documents in workspace with ownership verification
    const documents = await db
      .select({ objectiveDocument })
      .from(objectiveDocument)
      .innerJoin(workspace, eq(objectiveDocument.workspaceId, workspace.id))
      .where(
        and(
          eq(objectiveDocument.workspaceId, workspaceId),
          eq(workspace.userId, userId),
          isNull(workspace.deletedAt),
        ),
      )
      .orderBy(desc(objectiveDocument.updatedAt));

    // Get all objectives that reference these documents
    const objectives = await db
      .select()
      .from(objective)
      .where(eq(objective.workspaceId, workspaceId));

    // Create objective lookup map
    const objectiveMap = new Map(
      objectives.map((obj) => [obj.objectiveDocumentId, obj]),
    );

    // For each document, get its latest version
    const results = await Promise.all(
      documents.map(async ({ objectiveDocument: doc }) => {
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
 * Get a single objective document by ID with ownership verification
 */
export async function getObjectiveDocumentById(
  documentId: string,
  userId: string,
): Promise<ObjectiveDocumentWithVersions | null> {
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
      document: doc.objectiveDocument,
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
    // Verify ownership first
    const existing = await getObjectiveDocumentById(documentId, userId);
    if (!existing) {
      throw new ChatSDKError(
        'not_found:database',
        'Objective document not found or access denied',
      );
    }

    // Create new version using existing function
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
        // 3. Create new version (copies punchlist from latest)
        const newVersion = await createDocumentVersion(documentId, userId, {
          content: '',
        });
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
