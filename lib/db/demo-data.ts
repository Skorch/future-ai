import { chat, message, document, workspace } from '@/lib/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { db } from '@/lib/db/queries';
import { createWorkspace } from '@/lib/workspace/queries';
import { syncDocumentToRAG } from '@/lib/rag/sync';
import { logger } from '@/lib/logger';

interface CloneResult {
  success: boolean;
  workspaceId: string;
  error?: string;
  counts: {
    chats: number;
    messages: number;
    documents: number;
    votes: number;
  };
}

interface CloneContext {
  sourceWorkspaceId: string;
  targetWorkspaceId: string;
  targetUserId: string;
}

/**
 * Ensures user has a Demo workspace, creating one if needed
 */
export async function ensureDemoWorkspace(
  userId: string,
): Promise<CloneResult> {
  try {
    // Check for existing Demo workspace
    const existingDemo = await findUserDemoWorkspace(userId);

    if (existingDemo) {
      logger.info('Demo workspace already exists', {
        userId,
        workspaceId: existingDemo.id,
      });
      return {
        success: true,
        workspaceId: existingDemo.id,
        counts: { chats: 0, messages: 0, documents: 0, votes: 0 },
      };
    }

    // Clone from demo user
    return await cloneDemoWorkspace(userId);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to ensure demo workspace', {
      userId,
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
    });

    // Fallback: create empty workspace
    const fallbackWorkspace = await createWorkspace(
      userId,
      process.env.DEMO_WORKSPACE_NAME || 'Demo',
      'Your demo workspace to explore AI capabilities',
    );

    return {
      success: false,
      workspaceId: fallbackWorkspace.id,
      error: 'Failed to clone demo content, created empty workspace instead',
      counts: { chats: 0, messages: 0, documents: 0, votes: 0 },
    };
  }
}

/**
 * Finds user's Demo workspace if it exists
 */
async function findUserDemoWorkspace(userId: string) {
  const demoName = process.env.DEMO_WORKSPACE_NAME || 'Demo';

  const result = await db
    .select()
    .from(workspace)
    .where(
      and(
        eq(workspace.userId, userId),
        eq(workspace.name, demoName),
        isNull(workspace.deletedAt),
      ),
    )
    .limit(1);

  return result[0] || null;
}

/**
 * Clones demo content from source workspace to new user
 */
async function cloneDemoWorkspace(userId: string): Promise<CloneResult> {
  const sourceWorkspaceId = process.env.SOURCE_WORKSPACE_ID;
  const demoWorkspaceName = process.env.DEMO_WORKSPACE_NAME || 'Demo';

  if (!sourceWorkspaceId) {
    throw new Error('SOURCE_WORKSPACE_ID environment variable not configured');
  }

  logger.info('Starting demo workspace clone', { userId, sourceWorkspaceId });

  try {
    // 1. Verify source workspace exists
    const sourceWorkspace = await db
      .select()
      .from(workspace)
      .where(
        and(eq(workspace.id, sourceWorkspaceId), isNull(workspace.deletedAt)),
      )
      .limit(1);

    if (!sourceWorkspace[0]) {
      throw new Error(`Source workspace ${sourceWorkspaceId} not found`);
    }

    // 2. Create target Demo workspace
    const targetWorkspace = await createWorkspace(
      userId,
      demoWorkspaceName,
      'Explore AI capabilities with sample conversations and documents',
    );

    const context: CloneContext = {
      sourceWorkspaceId: sourceWorkspaceId,
      targetWorkspaceId: targetWorkspace.id,
      targetUserId: userId,
    };

    // 3. Clone documents first (may be referenced by messages)
    const docCount = await cloneDocuments(context);

    // 4. Clone chats
    const chatCount = await cloneChats(context);

    // 5. Clone messages for all chats
    const messageCount = await cloneMessages(context);

    // 6. Clone votes
    const voteCount = await cloneVotes(context);

    // 7. Index documents in RAG (fire-and-forget)
    indexClonedDocuments(context).catch((error) => {
      logger.error('Failed to index cloned documents in RAG', {
        error: error instanceof Error ? error.message : 'Unknown error',
        context,
      });
    });

    logger.info('Demo workspace clone completed', {
      userId,
      workspaceId: targetWorkspace.id,
      counts: {
        chats: chatCount,
        messages: messageCount,
        documents: docCount,
        votes: voteCount,
      },
    });

    return {
      success: true,
      workspaceId: targetWorkspace.id,
      counts: {
        chats: chatCount,
        messages: messageCount,
        documents: docCount,
        votes: voteCount,
      },
    };
  } catch (error) {
    logger.error('Demo workspace cloning failed', {
      userId,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });

    // Try to clean up any partially created workspace
    try {
      const demoName = process.env.DEMO_WORKSPACE_NAME || 'Demo';
      await db
        .update(workspace)
        .set({ deletedAt: new Date() })
        .where(and(eq(workspace.userId, userId), eq(workspace.name, demoName)));
    } catch (cleanupError) {
      logger.error('Failed to clean up partial demo workspace', {
        userId,
        error:
          cleanupError instanceof Error
            ? cleanupError.message
            : 'Unknown error',
      });
    }

    throw error;
  }
}

/**
 * Clone all documents from source to target workspace
 */
async function cloneDocuments(context: CloneContext): Promise<number> {
  try {
    // Fetch source documents and insert with transformed values
    // INSERT-SELECT with DEFAULT not working reliably, using fetch-then-insert
    const sourceDocuments = await db
      .select()
      .from(document)
      .where(eq(document.workspaceId, context.sourceWorkspaceId));

    if (sourceDocuments.length === 0) {
      logger.debug('No documents to clone', { context });
      return 0;
    }

    // Transform and batch insert - omit id to let DB auto-generate
    const documentsToInsert = sourceDocuments.map((doc) => ({
      createdAt: new Date(),
      title: doc.title,
      content: doc.content,
      kind: doc.kind,
      workspaceId: context.targetWorkspaceId,
      createdByUserId: context.targetUserId,
      metadata: doc.metadata,
      sourceDocumentIds: doc.sourceDocumentIds,
    }));

    await db.insert(document).values(documentsToInsert);

    logger.debug('Cloned documents', {
      count: documentsToInsert.length,
      context,
    });
    return documentsToInsert.length;
  } catch (error) {
    logger.error('Failed to clone documents', {
      error: error instanceof Error ? error.message : 'Unknown error',
      context,
    });
    return 0;
  }
}

/**
 * Clone all chats from source to target workspace
 */
async function cloneChats(context: CloneContext): Promise<number> {
  try {
    // Fetch source chats and insert with transformed values
    // INSERT-SELECT with DEFAULT not working reliably, using fetch-then-insert
    const sourceChats = await db
      .select()
      .from(chat)
      .where(eq(chat.workspaceId, context.sourceWorkspaceId));

    if (sourceChats.length === 0) {
      logger.debug('No chats to clone', { context });
      return 0;
    }

    // Transform and batch insert - omit id to let DB auto-generate
    const chatsToInsert = sourceChats.map((sourceChat) => ({
      createdAt: new Date(),
      title: sourceChat.title,
      userId: context.targetUserId,
      workspaceId: context.targetWorkspaceId,
      visibility: sourceChat.visibility,
      mode: sourceChat.mode,
      modeSetAt: sourceChat.modeSetAt,
      goal: sourceChat.goal,
      goalSetAt: sourceChat.goalSetAt,
      todoList: sourceChat.todoList,
      todoListUpdatedAt: sourceChat.todoListUpdatedAt,
      complete: sourceChat.complete,
      completedAt: sourceChat.completedAt,
      firstCompletedAt: sourceChat.firstCompletedAt,
    }));

    await db.insert(chat).values(chatsToInsert);

    logger.debug('Cloned chats', { count: chatsToInsert.length, context });
    return chatsToInsert.length;
  } catch (error) {
    logger.error('Failed to clone chats', {
      error: error instanceof Error ? error.message : 'Unknown error',
      context,
    });
    return 0;
  }
}

/**
 * Clone all messages for cloned chats
 */
async function cloneMessages(context: CloneContext): Promise<number> {
  try {
    // Get source and target chats to map IDs
    const [sourceChats, targetChats] = await Promise.all([
      db
        .select()
        .from(chat)
        .where(eq(chat.workspaceId, context.sourceWorkspaceId)),
      db
        .select()
        .from(chat)
        .where(eq(chat.workspaceId, context.targetWorkspaceId)),
    ]);

    if (sourceChats.length === 0 || targetChats.length === 0) {
      logger.debug('No chats to clone messages for', { context });
      return 0;
    }

    // Create mapping based on title and createdAt order
    const chatMapping = new Map<string, string>();
    sourceChats.forEach((sourceChat) => {
      // Find matching target chat by title
      const targetChat = targetChats.find((t) => t.title === sourceChat.title);
      if (targetChat) {
        chatMapping.set(sourceChat.id, targetChat.id);
      }
    });

    // Clone messages for each mapped chat
    let totalMessages = 0;
    for (const [sourceChatId, targetChatId] of chatMapping) {
      const sourceMessages = await db
        .select()
        .from(message)
        .where(eq(message.chatId, sourceChatId));

      if (sourceMessages.length > 0) {
        const messagesToInsert = sourceMessages.map((msg) => ({
          chatId: targetChatId,
          role: msg.role,
          parts: msg.parts,
          attachments: msg.attachments,
          createdAt: msg.createdAt,
        }));

        await db.insert(message).values(messagesToInsert);
        totalMessages += messagesToInsert.length;
      }
    }

    logger.debug('Cloned messages', { count: totalMessages, context });
    return totalMessages;
  } catch (error) {
    logger.error('Failed to clone messages', {
      error: error instanceof Error ? error.message : 'Unknown error',
      context,
    });
    return 0;
  }
}

/**
 * Clone votes for cloned chats/messages
 */
async function cloneVotes(context: CloneContext): Promise<number> {
  try {
    // Complex: need to map both chat and message IDs
    // For simplicity, we'll skip votes in the initial implementation
    // since they're not critical for demo content
    logger.debug('Skipping vote cloning for demo workspace', { context });
    return 0;
  } catch (error) {
    logger.error('Failed to clone votes', {
      error: error instanceof Error ? error.message : 'Unknown error',
      context,
    });
    return 0;
  }
}

/**
 * Index cloned documents in RAG system
 */
async function indexClonedDocuments(context: CloneContext): Promise<void> {
  try {
    // Fetch all cloned documents
    const documents = await db
      .select()
      .from(document)
      .where(eq(document.workspaceId, context.targetWorkspaceId));

    logger.info('Indexing cloned documents in RAG', {
      count: documents.length,
      workspaceId: context.targetWorkspaceId,
    });

    // Index each document
    for (const doc of documents) {
      try {
        await syncDocumentToRAG(doc.id, context.targetWorkspaceId);
      } catch (error) {
        logger.error('Failed to index document in RAG', {
          documentId: doc.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    logger.info('Completed RAG indexing for cloned documents', {
      workspaceId: context.targetWorkspaceId,
    });
  } catch (error) {
    logger.error('Failed to index cloned documents', {
      error: error instanceof Error ? error.message : 'Unknown error',
      context,
    });
  }
}
