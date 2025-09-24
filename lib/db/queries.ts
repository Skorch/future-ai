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
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import {
  user,
  chat,
  type User,
  document,
  type Suggestion,
  suggestion,
  message,
  vote,
  type DBMessage,
  type Chat,
  type ChatMode,
  stream,
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

// biome-ignore lint: Forbidden non-null assertion.
const client = postgres(process.env.POSTGRES_URL!);
const db = drizzle(client);

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
    return await db.insert(user).values({ email, password: hashedPassword });
  } catch (error) {
    throw new ChatSDKError('bad_request:database', 'Failed to create user');
  }
}

export async function createGuestUser() {
  const email = `guest-${Date.now()}`;
  const password = generateHashedPassword(generateUUID());

  try {
    return await db.insert(user).values({ email, password }).returning({
      id: user.id,
      email: user.email,
    });
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
}: {
  id: string;
  userId: string;
  title: string;
  visibility: VisibilityType;
}) {
  try {
    return await db.insert(chat).values({
      id,
      createdAt: new Date(),
      userId,
      title,
      visibility,
    });
  } catch (error) {
    throw new ChatSDKError('bad_request:database', 'Failed to save chat');
  }
}

export async function deleteChatById({ id }: { id: string }) {
  try {
    await db.delete(vote).where(eq(vote.chatId, id));
    await db.delete(message).where(eq(message.chatId, id));
    await db.delete(stream).where(eq(stream.chatId, id));

    const [chatsDeleted] = await db
      .delete(chat)
      .where(eq(chat.id, id))
      .returning();
    return chatsDeleted;
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to delete chat by id',
    );
  }
}

export async function getChatsByUserId({
  id,
  limit,
  startingAfter,
  endingBefore,
}: {
  id: string;
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
            ? and(whereCondition, eq(chat.userId, id))
            : eq(chat.userId, id),
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

export async function getChatById({ id }: { id: string }) {
  try {
    const [selectedChat] = await db.select().from(chat).where(eq(chat.id, id));
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
  metadata,
  sourceDocumentIds,
}: {
  id?: string;
  title: string;
  kind: ArtifactKind;
  content: string;
  userId: string;
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
        userId,
        createdAt: new Date(),
        metadata: (metadata || {}) as Record<string, unknown>,
        sourceDocumentIds: sourceDocumentIds || [],
      })
      .returning();

    // Automatically sync to RAG (async, don't await)
    syncDocumentToRAG(documentId).catch((err) =>
      console.error('[saveDocument] RAG sync failed:', err),
    );

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

export async function deleteDocument(id: string) {
  try {
    // Delete from RAG first (before document is gone)
    await deleteFromRAG(id);

    // Then delete related suggestions
    await db.delete(suggestion).where(eq(suggestion.documentId, id));

    // Finally delete the document
    const result = await db
      .delete(document)
      .where(eq(document.id, id))
      .returning();

    return result[0];
  } catch (error) {
    throw new ChatSDKError('bad_request:database', 'Failed to delete document');
  }
}

export async function getDocumentsById({ id }: { id: string }) {
  try {
    const documents = await db
      .select()
      .from(document)
      .where(eq(document.id, id))
      .orderBy(asc(document.createdAt));

    return documents;
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get documents by id',
    );
  }
}

export async function getDocumentById({ id }: { id: string }) {
  try {
    const [selectedDocument] = await db
      .select()
      .from(document)
      .where(eq(document.id, id))
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
    await db
      .delete(suggestion)
      .where(
        and(
          eq(suggestion.documentId, id),
          gt(suggestion.documentCreatedAt, timestamp),
        ),
      );

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

export async function getAllUserDocuments({ userId }: { userId: string }) {
  try {
    const documents = await db
      .select({
        id: document.id,
        title: document.title,
        createdAt: document.createdAt,
        metadata: document.metadata,
        sourceDocumentIds: document.sourceDocumentIds,
        contentLength: sql<number>`LENGTH(${document.content})`,
        contentPreview: sql<string>`SUBSTRING(${document.content}, 1, 500)`,
      })
      .from(document)
      .where(eq(document.userId, userId))
      .orderBy(desc(document.createdAt));

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
  maxChars,
}: {
  documentId: string;
  userId: string;
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
      .where(and(eq(document.id, documentId), eq(document.userId, userId)));

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
  maxCharsPerDoc,
}: {
  documentIds: string[];
  userId: string;
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
        and(inArray(document.id, documentIds), eq(document.userId, userId)),
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

export async function saveSuggestions({
  suggestions,
}: {
  suggestions: Array<Suggestion>;
}) {
  try {
    return await db.insert(suggestion).values(suggestions);
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to save suggestions',
    );
  }
}

export async function getSuggestionsByDocumentId({
  documentId,
}: {
  documentId: string;
}) {
  try {
    return await db
      .select()
      .from(suggestion)
      .where(and(eq(suggestion.documentId, documentId)));
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get suggestions by document id',
    );
  }
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

export async function deleteAllUserData(userId: string): Promise<void> {
  try {
    // Get all chats for this user first
    const userChats = await db
      .select({ id: chat.id })
      .from(chat)
      .where(eq(chat.userId, userId));
    const chatIds = userChats.map((c) => c.id);

    // Delete suggestions (references documents and user)
    await db.delete(suggestion).where(eq(suggestion.userId, userId));

    // Delete votes for user's chats
    for (const chatId of chatIds) {
      await db.delete(vote).where(eq(vote.chatId, chatId));
    }

    // Delete stream metadata for user's chats
    for (const chatId of chatIds) {
      await db.delete(stream).where(eq(stream.chatId, chatId));
    }

    // Delete messages for user's chats
    for (const chatId of chatIds) {
      await db.delete(message).where(eq(message.chatId, chatId));
    }

    // Delete chats
    await db.delete(chat).where(eq(chat.userId, userId));

    // Delete documents
    await db.delete(document).where(eq(document.userId, userId));
  } catch (error) {
    console.error('[DAL] Error deleting user data:', error);
    throw new ChatSDKError(
      'internal_server_error:database',
      'Failed to delete user data',
    );
  }
}

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
