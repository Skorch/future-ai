import 'server-only';

import { desc, eq, max } from 'drizzle-orm';
import { db } from './queries';
import {
  objective,
  objectiveDocument,
  objectiveDocumentVersion,
} from './schema';
import type { ObjectiveDocument, ObjectiveDocumentVersion } from './schema';
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
  data: { title: string; content: string; chatId?: string },
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
          chatId: data.chatId,
          content: data.content,
          versionNumber: 1,
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
  chatId: string,
  userId: string,
  data: { content: string; metadata?: Record<string, unknown> },
): Promise<ObjectiveDocumentVersion> {
  try {
    // Get current max version number
    const [maxVersionResult] = await db
      .select({ maxVersion: max(objectiveDocumentVersion.versionNumber) })
      .from(objectiveDocumentVersion)
      .where(eq(objectiveDocumentVersion.documentId, documentId));

    const nextVersionNumber = (maxVersionResult?.maxVersion || 0) + 1;

    // Create new version
    const [version] = await db
      .insert(objectiveDocumentVersion)
      .values({
        documentId,
        chatId,
        content: data.content,
        metadata: data.metadata,
        versionNumber: nextVersionNumber,
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

export async function deleteVersionsByChatId(chatId: string): Promise<void> {
  try {
    await db
      .delete(objectiveDocumentVersion)
      .where(eq(objectiveDocumentVersion.chatId, chatId));
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to delete versions by chat',
    );
  }
}
