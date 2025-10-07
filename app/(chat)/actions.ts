'use server';

import { generateText, type UIMessage } from 'ai';
import {
  deleteMessagesByChatIdAfterTimestamp,
  getMessageById,
  updateChatVisiblityById,
  db,
} from '@/lib/db/queries';
import { chat } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import type { VisibilityType } from '@/components/visibility-selector';
import { myProvider } from '@/lib/ai/providers';
import { getLogger } from '@/lib/logger';
import { cleanOrphanedVersions } from '@/lib/db/documents';

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

  // Clean up orphaned document versions after message deletion
  const [chatRecord] = await db
    .select()
    .from(chat)
    .where(eq(chat.id, message.chatId));

  if (chatRecord) {
    await cleanOrphanedVersions(chatRecord.workspaceId);
  }
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
