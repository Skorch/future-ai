'use server';

import { generateText, type UIMessage } from 'ai';
import {
  deleteMessagesByChatIdAfterTimestamp,
  getMessageById,
  updateChatVisiblityById,
} from '@/lib/db/queries';
import type { VisibilityType } from '@/components/visibility-selector';
import { myProvider } from '@/lib/ai/providers';
import { getLogger } from '@/lib/logger';

const logger = getLogger('ChatActions');

export async function generateTitleFromUserMessage({
  message,
}: {
  message: UIMessage;
}) {
  const { text: title } = await generateText({
    model: myProvider.languageModel('title-model'),
    system: `\n
    - you will generate a short title based on the first message a user begins a conversation with
    - ensure it is not more than 80 characters long
    - the title should be a summary of the user's message
    - do not use quotes or colons`,
    prompt: JSON.stringify(message),
  });

  return title;
}

export async function deleteTrailingMessages({ id }: { id: string }) {
  const [message] = await getMessageById({ id });

  if (!message) {
    logger.error(`Message not found with id: ${id}`);
    throw new Error(`Message not found with id: ${id}`);
  }

  await deleteMessagesByChatIdAfterTimestamp({
    chatId: message.chatId,
    timestamp: message.createdAt,
  });

  // PHASE 1 NOTE: Orphaned version cleanup temporarily disabled
  // Chat no longer has workspaceId (moved to objective)
  // Will be re-implemented in Phase 2 with proper objective join
  // const [chatRecord] = await db
  //   .select()
  //   .from(chat)
  //   .where(eq(chat.id, message.chatId));
  //
  // if (chatRecord) {
  //   await cleanOrphanedVersions(chatRecord.workspaceId);
  // }
}

export async function updateChatVisibility({
  chatId,
  visibility,
}: {
  chatId: string;
  visibility: VisibilityType;
}) {
  await updateChatVisiblityById({ chatId, visibility });
}
