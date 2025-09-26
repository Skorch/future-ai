import 'server-only';

import {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  gte,
  inArray,
  lt,
  sql,
  type SQL,
} from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/vercel-postgres';
import { sql as vercelSql } from '@vercel/postgres';

import {
  user,
  chat,
  type User,
  document,
  message,
  vote,
  type DBMessage,
  type Chat,
  type ChatMode,
  stream,
  workspace,
} from './schema';
import { syncDocumentToRAG, deleteFromRAG } from '@/lib/rag/sync';
import type { ArtifactKind } from '@/components/artifact';
import { generateUUID } from '../utils';
import { generateHashedPassword } from './utils';
import type { VisibilityType } from '@/components/visibility-selector';
import { ChatSDKError } from '../errors';

// Optionally, if not using email/pass login, you can
// use the Drizzle adapter for Auth.js / NextAuth
// https://authjs.dev/reference/adapter/drizzle

// Using @vercel/postgres for better serverless support
const db = drizzle(vercelSql);

// Export db instance for use in other files
export { db };

export async function getUser(email: string): Promise<Array<User>> {
  try {
    return await db.select().from(user).where(eq(user.email, email));
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get user by email',
    );
  }
}

export async function createUser(email: string, password: string) {
  const hashedPassword = generateHashedPassword(password);

  try {
    return await db.transaction(async (tx) => {
      // Create user
      const [newUser] = await tx
        .insert(user)
        .values({ email, password: hashedPassword })
        .returning();

      // Auto-create Personal workspace with UUID
      const workspaceId = generateUUID();
      await tx.insert(workspace).values({
        id: workspaceId,
        userId: newUser.id,
        name: 'Personal',
        description: 'Your personal workspace',
      });

      return newUser;
    });
  } catch (error) {
    throw new ChatSDKError('bad_request:database', 'Failed to create user');
  }
}

export async function createGuestUser() {
  const email = `guest-${Date.now()}`;
  const password = generateHashedPassword(generateUUID());

  try {
    // Create guest user first
    const [guestUser] = await db
      .insert(user)
      .values({ email, password })
      .returning({
        id: user.id,
        email: user.email,
      });

    // Then create workspace - both are awaited so they complete before returning
    const workspaceId = generateUUID();
    await db.insert(workspace).values({
      id: workspaceId,
      userId: guestUser.id,
      name: 'Guest Workspace',
      description: 'Temporary workspace for guest access',
    });

    return guestUser;
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to create guest user',
    );
  }
}

export async function saveChat({
  id,
  userId,
  title,
  visibility,
  workspaceId,
}: {
  id: string;
  userId: string;
  title: string;
  visibility: VisibilityType;
  workspaceId: string;
}) {
  try {
    return await db.insert(chat).values({
      id,
      createdAt: new Date(),
      userId,
      title,
      visibility,
      workspaceId,
    });
  } catch (error) {
    throw new ChatSDKError('bad_request:database', 'Failed to save chat');
  }
}

export async function deleteChatById({
  id,
  workspaceId,
}: { id: string; workspaceId: string }) {
  try {
    // Verify chat belongs to workspace first
    const [chatToDelete] = await db
      .select()
      .from(chat)
      .where(and(eq(chat.id, id), eq(chat.workspaceId, workspaceId)))
      .limit(1);

    if (!chatToDelete) {
      return null; // Chat doesn't exist or doesn't belong to workspace
    }

    await db.delete(vote).where(eq(vote.chatId, id));
    await db.delete(message).where(eq(message.chatId, id));
    await db.delete(stream).where(eq(stream.chatId, id));

    const [chatsDeleted] = await db
      .delete(chat)
      .where(and(eq(chat.id, id), eq(chat.workspaceId, workspaceId)))
      .returning();
    return chatsDeleted;
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to delete chat by id',
    );
  }
}

export async function getChatsByWorkspaceAndUser({
  workspaceId,
  userId,
  limit,
  startingAfter,
  endingBefore,
}: {
  workspaceId: string;
  userId: string;
  limit: number;
  startingAfter: string | null;
  endingBefore: string | null;
}) {
  try {
    const extendedLimit = limit + 1;

    const query = (whereCondition?: SQL<unknown>) =>
      db
        .select()
        .from(chat)
        .where(
          whereCondition
            ? and(
                whereCondition,
                eq(chat.workspaceId, workspaceId),
                eq(chat.userId, userId),
              )
            : and(eq(chat.workspaceId, workspaceId), eq(chat.userId, userId)),
        )
        .orderBy(desc(chat.createdAt))
        .limit(extendedLimit);

    let filteredChats: Array<Chat> = [];

    if (startingAfter) {
      const [selectedChat] = await db
        .select()
        .from(chat)
        .where(eq(chat.id, startingAfter));

      filteredChats = await query(gt(chat.createdAt, selectedChat.createdAt));
    } else if (endingBefore) {
      const [selectedChat] = await db
        .select()
        .from(chat)
        .where(eq(chat.id, endingBefore));

      filteredChats = await query(lt(chat.createdAt, selectedChat.createdAt));
    } else {
      filteredChats = await query();
    }

    const hasMore = filteredChats.length > limit;

    return filteredChats.slice(0, limit).map((chat) => ({
      ...chat,
      hasMore,
      hasBefore: startingAfter ? true : !!endingBefore,
    }));
  } catch (error) {
    console.error(
      '[Database] Error getting chats by workspace and user:',
      error,
    );
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get chats by workspace and user',
    );
  }
}

export async function getChatsByWorkspaceAndUserId({
  workspaceId,
  userId,
  limit,
  startingAfter,
  endingBefore,
}: {
  workspaceId: string;
  userId: string;
  limit: number;
  startingAfter: string | null;
  endingBefore: string | null;
}) {
  try {
    const extendedLimit = limit + 1;

    const query = (whereCondition?: SQL<unknown>) =>
      db
        .select()
        .from(chat)
        .where(
          whereCondition
            ? and(
                whereCondition,
                eq(chat.workspaceId, workspaceId),
                eq(chat.userId, userId),
              )
            : and(eq(chat.workspaceId, workspaceId), eq(chat.userId, userId)),
        )
        .orderBy(desc(chat.createdAt))
        .limit(extendedLimit);

    let filteredChats: Array<Chat> = [];

    if (startingAfter) {
      const [selectedChat] = await db
        .select()
        .from(chat)
        .where(eq(chat.id, startingAfter))
        .limit(1);

      if (!selectedChat) {
        throw new ChatSDKError(
          'not_found:database',
          `Chat with id ${startingAfter} not found`,
        );
      }

      filteredChats = await query(gt(chat.createdAt, selectedChat.createdAt));
    } else if (endingBefore) {
      const [selectedChat] = await db
        .select()
        .from(chat)
        .where(eq(chat.id, endingBefore))
        .limit(1);

      if (!selectedChat) {
        throw new ChatSDKError(
          'not_found:database',
          `Chat with id ${endingBefore} not found`,
        );
      }

      filteredChats = await query(lt(chat.createdAt, selectedChat.createdAt));
    } else {
      filteredChats = await query();
    }

    const hasMore = filteredChats.length > limit;

    return {
      chats: hasMore ? filteredChats.slice(0, limit) : filteredChats,
      hasMore,
    };
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get chats by user id',
    );
  }
}

export async function getChatById({
  id,
  workspaceId,
}: { id: string; workspaceId: string }) {
  try {
    const [selectedChat] = await db
      .select()
      .from(chat)
      .where(and(eq(chat.id, id), eq(chat.workspaceId, workspaceId)));
    return selectedChat;
  } catch (error) {
    throw new ChatSDKError('bad_request:database', 'Failed to get chat by id');
  }
}

export async function saveMessages({
  messages,
}: {
  messages: Array<DBMessage>;
}) {
  try {
    return await db.insert(message).values(messages);
  } catch (error) {
    throw new ChatSDKError('bad_request:database', 'Failed to save messages');
  }
}

export async function getMessagesByChatId({ id }: { id: string }) {
  try {
    return await db
      .select()
      .from(message)
      .where(eq(message.chatId, id))
      .orderBy(asc(message.createdAt));
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get messages by chat id',
    );
  }
}

export async function voteMessage({
  chatId,
  messageId,
  type,
}: {
  chatId: string;
  messageId: string;
  type: 'up' | 'down';
}) {
  try {
    const [existingVote] = await db
      .select()
      .from(vote)
      .where(and(eq(vote.messageId, messageId)));

    if (existingVote) {
      return await db
        .update(vote)
        .set({ isUpvoted: type === 'up' })
        .where(and(eq(vote.messageId, messageId), eq(vote.chatId, chatId)));
    }
    return await db.insert(vote).values({
      chatId,
      messageId,
      isUpvoted: type === 'up',
    });
  } catch (error) {
    throw new ChatSDKError('bad_request:database', 'Failed to vote message');
  }
}

export async function getVotesByChatId({ id }: { id: string }) {
  try {
    return await db.select().from(vote).where(eq(vote.chatId, id));
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get votes by chat id',
    );
  }
}

export async function saveDocument({
  id,
  title,
  kind,
  content,
  userId,
  workspaceId,
  metadata,
  sourceDocumentIds,
}: {
  id?: string;
  title: string;
  kind: ArtifactKind;
  content: string;
  userId: string;
  workspaceId: string;
  metadata?: Record<string, unknown>;
  sourceDocumentIds?: string[];
}) {
  try {
    const documentId = id || generateUUID();

    const result = await db
      .insert(document)
      .values({
        id: documentId,
        title,
        kind,
        content,
        workspaceId,
        createdByUserId: userId,
        createdAt: new Date(),
        metadata: (metadata || {}) as Record<string, unknown>,
        sourceDocumentIds: sourceDocumentIds || [],
      })
      .returning();

    // Automatically sync to RAG (async, don't await)
    console.log('[saveDocument] Starting RAG sync', {
      documentId,
      workspaceId,
      title,
      kind,
    });
    syncDocumentToRAG(documentId, workspaceId)
      .then(() => {
        console.log('[saveDocument] RAG sync completed successfully', {
          documentId,
          workspaceId,
        });
      })
      .catch((err) => {
        console.error('[saveDocument] RAG sync failed', {
          documentId,
          workspaceId,
          title,
          kind,
          error: err,
          errorMessage: err instanceof Error ? err.message : String(err),
          errorStack: err instanceof Error ? err.stack : undefined,
        });
      });

    return result;
  } catch (error) {
    console.error('[saveDocument] Database error:', error);
    throw new ChatSDKError('bad_request:database', 'Failed to save document');
  }
}

export async function updateDocument(
  id: string,
  updates: Partial<
    Omit<typeof document.$inferSelect, 'id' | 'createdAt' | 'userId'>
  >,
) {
  try {
    const result = await db
      .update(document)
      .set(updates)
      .where(eq(document.id, id))
      .returning();

    // Automatically sync to RAG (async, don't await)
    syncDocumentToRAG(id).catch((err) =>
      console.error('[updateDocument] RAG sync failed:', err),
    );

    return result[0];
  } catch (error) {
    throw new ChatSDKError('bad_request:database', 'Failed to update document');
  }
}

export async function deleteDocument(id: string, workspaceId: string) {
  try {
    // First verify the document belongs to this workspace
    const [doc] = await db
      .select()
      .from(document)
      .where(and(eq(document.id, id), eq(document.workspaceId, workspaceId)))
      .limit(1);

    if (!doc) {
      return null; // Document doesn't exist or doesn't belong to workspace
    }

    // Delete from RAG first (before document is gone)
    await deleteFromRAG(id, workspaceId);

    // Delete the document
    const result = await db
      .delete(document)
      .where(and(eq(document.id, id), eq(document.workspaceId, workspaceId)))
      .returning();

    return result[0];
  } catch (error) {
    throw new ChatSDKError('bad_request:database', 'Failed to delete document');
  }
}

export async function getDocumentsById({
  id,
  workspaceId,
}: { id: string; workspaceId: string }) {
  try {
    const documents = await db
      .select()
      .from(document)
      .where(and(eq(document.id, id), eq(document.workspaceId, workspaceId)))
      .orderBy(asc(document.createdAt));

    return documents;
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get documents by id',
    );
  }
}

export async function getDocumentById({
  id,
  workspaceId,
}: { id: string; workspaceId: string }) {
  try {
    const [selectedDocument] = await db
      .select()
      .from(document)
      .where(and(eq(document.id, id), eq(document.workspaceId, workspaceId)))
      .orderBy(desc(document.createdAt));

    return selectedDocument;
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get document by id',
    );
  }
}

export async function deleteDocumentsByIdAfterTimestamp({
  id,
  timestamp,
}: {
  id: string;
  timestamp: Date;
}) {
  try {
    return await db
      .delete(document)
      .where(and(eq(document.id, id), gt(document.createdAt, timestamp)))
      .returning();
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to delete documents by id after timestamp',
    );
  }
}

export async function getAllUserDocuments({
  userId,
  workspaceId,
}: { userId: string; workspaceId: string }) {
  try {
    // Get the latest version of each document by using DISTINCT ON with document.id
    // This ensures we only get one row per document ID (the most recent one)
    // We need to order by id first for DISTINCT ON, then by createdAt DESC to get the latest version
    const documentsQuery = await db
      .selectDistinctOn([document.id], {
        id: document.id,
        title: document.title,
        createdAt: document.createdAt,
        metadata: document.metadata,
        sourceDocumentIds: document.sourceDocumentIds,
        contentLength: sql<number>`LENGTH(${document.content})`,
        contentPreview: sql<string>`SUBSTRING(${document.content}, 1, 500)`,
      })
      .from(document)
      .where(eq(document.workspaceId, workspaceId))
      .orderBy(document.id, desc(document.createdAt));

    // Sort the final results by createdAt descending to show newest documents first
    const documents = documentsQuery.sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    );

    return documents.map((doc) => {
      const metadata = doc.metadata as {
        documentType?: 'transcript' | 'meeting-summary';
        fileName?: string;
        fileSize?: number;
        uploadedAt?: string;
        meetingDate?: string;
        participants?: string[];
        [key: string]: unknown;
      } | null;

      return {
        ...doc,
        estimatedTokens: Math.ceil(doc.contentLength / 4),
        humanReadableSize: formatBytes(doc.contentLength),
        documentType:
          metadata?.documentType ||
          ('document' as 'transcript' | 'meeting-summary' | 'document'),
        sourceDocumentIds: (doc.sourceDocumentIds || []) as string[],
      };
    });
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get user documents',
    );
  }
}

export async function getDocumentForUser({
  documentId,
  userId,
  workspaceId,
  maxChars,
}: {
  documentId: string;
  userId: string;
  workspaceId: string;
  maxChars?: number;
}) {
  try {
    const query = db
      .select({
        id: document.id,
        title: document.title,
        content: maxChars
          ? sql<string>`SUBSTRING(${document.content}, 1, ${maxChars})`
          : document.content,
        metadata: document.metadata,
        sourceDocumentIds: document.sourceDocumentIds,
        createdAt: document.createdAt,
        fullContentLength: sql<number>`LENGTH(${document.content})`,
      })
      .from(document)
      .where(
        and(eq(document.id, documentId), eq(document.workspaceId, workspaceId)),
      );

    const [doc] = await query;

    if (!doc) {
      return null;
    }

    return {
      ...doc,
      truncated: maxChars ? doc.fullContentLength > maxChars : false,
      loadedChars: maxChars
        ? Math.min(maxChars, doc.fullContentLength)
        : doc.fullContentLength,
    };
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get document for user',
    );
  }
}

export async function getDocumentsForUser({
  documentIds,
  userId,
  workspaceId,
  maxCharsPerDoc,
}: {
  documentIds: string[];
  userId: string;
  workspaceId: string;
  maxCharsPerDoc?: number;
}) {
  try {
    if (documentIds.length === 0) {
      return [];
    }

    const documents = await db
      .select({
        id: document.id,
        title: document.title,
        content: maxCharsPerDoc
          ? sql<string>`SUBSTRING(${document.content}, 1, ${maxCharsPerDoc})`
          : document.content,
        metadata: document.metadata,
        sourceDocumentIds: document.sourceDocumentIds,
        createdAt: document.createdAt,
        fullContentLength: sql<number>`LENGTH(${document.content})`,
      })
      .from(document)
      .where(
        and(
          inArray(document.id, documentIds),
          eq(document.workspaceId, workspaceId),
        ),
      );

    return documents.map((doc) => {
      const metadata = doc.metadata as {
        documentType?: 'transcript' | 'meeting-summary';
        fileName?: string;
        fileSize?: number;
        uploadedAt?: string;
        meetingDate?: string;
        participants?: string[];
        [key: string]: unknown;
      } | null;

      return {
        ...doc,
        documentType:
          metadata?.documentType ||
          ('document' as 'transcript' | 'meeting-summary' | 'document'),
        truncated: maxCharsPerDoc
          ? doc.fullContentLength > maxCharsPerDoc
          : false,
        loadedChars: maxCharsPerDoc
          ? Math.min(maxCharsPerDoc, doc.fullContentLength)
          : doc.fullContentLength,
      };
    });
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get documents for user',
    );
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${Number.parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`;
}

export async function getMessageById({ id }: { id: string }) {
  try {
    return await db.select().from(message).where(eq(message.id, id));
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get message by id',
    );
  }
}

export async function deleteMessagesByChatIdAfterTimestamp({
  chatId,
  timestamp,
}: {
  chatId: string;
  timestamp: Date;
}) {
  try {
    const messagesToDelete = await db
      .select({ id: message.id })
      .from(message)
      .where(
        and(eq(message.chatId, chatId), gte(message.createdAt, timestamp)),
      );

    const messageIds = messagesToDelete.map((message) => message.id);

    if (messageIds.length > 0) {
      await db
        .delete(vote)
        .where(
          and(eq(vote.chatId, chatId), inArray(vote.messageId, messageIds)),
        );

      return await db
        .delete(message)
        .where(
          and(eq(message.chatId, chatId), inArray(message.id, messageIds)),
        );
    }
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to delete messages by chat id after timestamp',
    );
  }
}

export async function updateChatVisiblityById({
  chatId,
  visibility,
}: {
  chatId: string;
  visibility: 'private' | 'public';
}) {
  try {
    return await db.update(chat).set({ visibility }).where(eq(chat.id, chatId));
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to update chat visibility by id',
    );
  }
}

export async function getMessageCountByUserId({
  id,
  differenceInHours,
}: { id: string; differenceInHours: number }) {
  try {
    const twentyFourHoursAgo = new Date(
      Date.now() - differenceInHours * 60 * 60 * 1000,
    );

    const [stats] = await db
      .select({ count: count(message.id) })
      .from(message)
      .innerJoin(chat, eq(message.chatId, chat.id))
      .where(
        and(
          eq(chat.userId, id),
          gte(message.createdAt, twentyFourHoursAgo),
          eq(message.role, 'user'),
        ),
      )
      .execute();

    return stats?.count ?? 0;
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get message count by user id',
    );
  }
}

export async function createStreamId({
  streamId,
  chatId,
}: {
  streamId: string;
  chatId: string;
}) {
  try {
    await db
      .insert(stream)
      .values({ id: streamId, chatId, createdAt: new Date() });
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to create stream id',
    );
  }
}

export async function getStreamIdsByChatId({ chatId }: { chatId: string }) {
  try {
    const streamIds = await db
      .select({ id: stream.id })
      .from(stream)
      .where(eq(stream.chatId, chatId))
      .orderBy(asc(stream.createdAt))
      .execute();

    return streamIds.map(({ id }) => id);
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get stream ids by chat id',
    );
  }
}

// deleteAllUserData function removed - no longer needed

// Mode System DAL Functions
export async function updateChatMode({
  id,
  mode,
}: {
  id: string;
  mode: ChatMode;
}) {
  const [updatedChat] = await db
    .update(chat)
    .set({
      mode,
      modeSetAt: new Date(),
    })
    .where(eq(chat.id, id))
    .returning();

  return updatedChat;
}

export async function getChatMode(id: string): Promise<ChatMode | undefined> {
  const result = await db
    .select({
      mode: chat.mode,
      modeSetAt: chat.modeSetAt,
    })
    .from(chat)
    .where(eq(chat.id, id))
    .limit(1);

  return result[0]?.mode as ChatMode | undefined;
}

export async function updateChatCompletion({
  id,
  complete,
  completedAt,
  firstCompletedAt,
}: {
  id: string;
  complete: boolean;
  completedAt: Date | null;
  firstCompletedAt?: Date; // undefined means don't update this field
}) {
  // Build update object conditionally
  const updateObj: Record<string, unknown> = {
    complete,
    completedAt,
  };

  // Only update firstCompletedAt if explicitly provided
  if (firstCompletedAt !== undefined) {
    // NOTE: We can't check existing chat without workspaceId
    // So we'll just set it - the database constraint will prevent duplicates
    updateObj.firstCompletedAt = firstCompletedAt;
  }

  const [updatedChat] = await db
    .update(chat)
    .set(updateObj)
    .where(eq(chat.id, id))
    .returning();

  return updatedChat;
}
