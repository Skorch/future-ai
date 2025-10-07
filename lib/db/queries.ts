import { getLogger } from '@/lib/logger';

const logger = getLogger('queries');
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
  type SQL,
} from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/vercel-postgres';
import { sql as vercelSql } from '@vercel/postgres';

import {
  user,
  chat,
  message,
  vote,
  type DBMessage,
  type Chat,
  type ChatMode,
  stream,
  documentEnvelope,
  documentVersion,
  documentEnvelopeRelations,
  documentVersionRelations,
  workspace,
  playbook,
  playbookStep,
} from './schema';
import type { VisibilityType } from '@/components/visibility-selector';
import { ChatSDKError } from '../errors';
import { cleanOrphanedVersions } from './documents';

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

    // Clean up orphaned document versions after chat deletion
    if (chatsDeleted) {
      await cleanOrphanedVersions(workspaceId);
    }

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
        .select({
          // Select all chat columns
          id: chat.id,
          createdAt: chat.createdAt,
          title: chat.title,
          userId: chat.userId,
          workspaceId: chat.workspaceId,
          visibility: chat.visibility,
          mode: chat.mode,
          modeSetAt: chat.modeSetAt,
          goal: chat.goal,
          goalSetAt: chat.goalSetAt,
          todoList: chat.todoList,
          todoListUpdatedAt: chat.todoListUpdatedAt,
          complete: chat.complete,
          completedAt: chat.completedAt,
          firstCompletedAt: chat.firstCompletedAt,
          // Add message count
          messageCount: count(message.id),
        })
        .from(chat)
        .leftJoin(message, eq(chat.id, message.chatId))
        .where(
          whereCondition
            ? and(
                whereCondition,
                eq(chat.workspaceId, workspaceId),
                eq(chat.userId, userId),
              )
            : and(eq(chat.workspaceId, workspaceId), eq(chat.userId, userId)),
        )
        .groupBy(
          chat.id,
          chat.createdAt,
          chat.title,
          chat.userId,
          chat.workspaceId,
          chat.visibility,
          chat.mode,
          chat.modeSetAt,
          chat.goal,
          chat.goalSetAt,
          chat.todoList,
          chat.todoListUpdatedAt,
          chat.complete,
          chat.completedAt,
          chat.firstCompletedAt,
        )
        .orderBy(desc(chat.createdAt))
        .limit(extendedLimit);

    let filteredChats: Array<Chat & { messageCount: number }> = [];

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
    logger.error(
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
