import { getLogger } from '@/lib/logger';

const logger = getLogger('queries');
import 'server-only';

import { and, asc, count, desc, eq, gte, inArray } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/vercel-postgres';
import { sql as vercelSql } from '@vercel/postgres';

import {
  user,
  chat,
  message,
  vote,
  type DBMessage,
  type ChatMode,
  stream,
  documentEnvelope,
  documentVersion,
  documentEnvelopeRelations,
  documentVersionRelations,
  workspace,
  playbook,
  playbookStep,
  objective,
} from './schema';
import { ChatSDKError } from '../errors';

// Optionally, if not using email/pass login, you can
// use the Drizzle adapter for Auth.js / NextAuth
// https://authjs.dev/reference/adapter/drizzle

// Using @vercel/postgres for better serverless support
const db = drizzle(vercelSql, {
  schema: {
    user,
    chat,
    message,
    vote,
    stream,
    documentEnvelope,
    documentVersion,
    documentEnvelopeRelations,
    documentVersionRelations,
    workspace,
    playbook,
    playbookStep,
  },
});

// Export db instance for use in other files
export { db };

// Get user by Clerk ID (which is now the primary key)
export async function getUserById(userId: string) {
  try {
    const [foundUser] = await db
      .select()
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);
    return foundUser;
  } catch (error) {
    throw new ChatSDKError('bad_request:database', 'Failed to get user by id');
  }
}

// Upsert user data (for welcome page sync and webhook handler)
export async function upsertUser(userData: {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  imageUrl?: string | null;
  emailVerified?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}) {
  try {
    const [upsertedUser] = await db
      .insert(user)
      .values(userData)
      .onConflictDoUpdate({
        target: user.id,
        set: {
          email: userData.email,
          firstName: userData.firstName,
          lastName: userData.lastName,
          imageUrl: userData.imageUrl,
          emailVerified: userData.emailVerified,
          updatedAt: userData.updatedAt || new Date(),
        },
      })
      .returning();

    return upsertedUser;
  } catch (error) {
    throw new ChatSDKError('bad_request:database', 'Failed to upsert user');
  }
}

// No longer needed - all users must authenticate with Clerk
// export async function createGuestUser() - REMOVED

export async function saveChat({
  id,
  userId,
  title,
  objectiveId,
  objectiveDocumentVersionId,
}: {
  id: string;
  userId: string;
  title: string;
  objectiveId: string;
  objectiveDocumentVersionId?: string;
}) {
  try {
    logger.debug('Attempting to save chat', {
      id,
      userId,
      objectiveId,
      objectiveDocumentVersionId,
      hasVersionId: !!objectiveDocumentVersionId,
    });

    return await db.insert(chat).values({
      id,
      createdAt: new Date(),
      userId,
      title,
      objectiveId,
      objectiveDocumentVersionId,
    });
  } catch (error) {
    logger.error('Database error in saveChat:', error);
    logger.error('Failed with values:', {
      id,
      userId,
      objectiveId,
      objectiveDocumentVersionId,
      title,
    });
    throw new ChatSDKError('bad_request:database', 'Failed to save chat');
  }
}

export async function deleteChatById({
  id,
  objectiveId,
}: { id: string; objectiveId: string }) {
  try {
    // Verify chat belongs to objective
    const [chatToDelete] = await db
      .select()
      .from(chat)
      .where(and(eq(chat.id, id), eq(chat.objectiveId, objectiveId)))
      .limit(1);

    if (!chatToDelete) {
      return null;
    }

    // Delete related records
    await db.delete(vote).where(eq(vote.chatId, id));
    await db.delete(message).where(eq(message.chatId, id));
    await db.delete(stream).where(eq(stream.chatId, id));

    // Delete chat (FK on Chat.objectiveDocumentVersionId handles SET NULL)
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
    // Join chat -> objective to filter by workspace
    const conditions = [
      eq(objective.workspaceId, workspaceId),
      eq(chat.userId, userId),
    ];

    if (startingAfter) {
      conditions.push(gte(chat.createdAt, new Date(startingAfter)));
    }

    if (endingBefore) {
      // Note: This would require a different operator for "before"
      // For now, treating as a simple timestamp filter
    }

    const chats = await db
      .select({
        chat,
        objective: {
          id: objective.id,
          workspaceId: objective.workspaceId,
        },
      })
      .from(chat)
      .innerJoin(objective, eq(chat.objectiveId, objective.id))
      .where(and(...conditions))
      .limit(limit)
      .orderBy(asc(chat.createdAt));

    return chats.map((row) => ({
      ...row.chat,
      objective: row.objective,
    }));
  } catch (error) {
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
  // NOTE: This appears to be duplicate of getChatsByWorkspaceAndUser
  // Delegating to that function for now
  return getChatsByWorkspaceAndUser({
    workspaceId,
    userId,
    limit,
    startingAfter,
    endingBefore,
  });
}

export async function getChatById({
  id,
  objectiveId,
}: { id: string; objectiveId: string }) {
  try {
    const [selectedChat] = await db
      .select()
      .from(chat)
      .where(and(eq(chat.id, id), eq(chat.objectiveId, objectiveId)));

    return selectedChat;
  } catch (error) {
    throw new ChatSDKError('bad_request:database', 'Failed to get chat by id');
  }
}

export async function getChatByIdWithWorkspace({
  id,
  workspaceId,
  userId,
}: { id: string; workspaceId: string; userId: string }) {
  try {
    const result = await db
      .select({ chat })
      .from(chat)
      .innerJoin(objective, eq(chat.objectiveId, objective.id))
      .where(
        and(
          eq(chat.id, id),
          eq(objective.workspaceId, workspaceId),
          eq(chat.userId, userId),
        ),
      )
      .limit(1);

    return result[0]?.chat || null;
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get chat by id with workspace',
    );
  }
}

export async function getChatsByObjectiveId(
  objectiveId: string,
  userId: string,
) {
  try {
    const chats = await db
      .select({
        id: chat.id,
        title: chat.title,
        createdAt: chat.createdAt,
        userId: chat.userId,
        objectiveId: chat.objectiveId,
        mode: chat.mode,
        complete: chat.complete,
        messageCount: count(message.id),
      })
      .from(chat)
      .leftJoin(message, eq(message.chatId, chat.id))
      .where(and(eq(chat.objectiveId, objectiveId), eq(chat.userId, userId)))
      .groupBy(
        chat.id,
        chat.title,
        chat.createdAt,
        chat.userId,
        chat.objectiveId,
        chat.mode,
        chat.complete,
      )
      .orderBy(desc(chat.createdAt));

    return chats;
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get chats by objective',
    );
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
