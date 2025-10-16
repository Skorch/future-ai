'use server';

import type { UIMessage } from 'ai';
import {
  deleteMessagesByChatIdAfterTimestamp,
  getMessageById,
} from '@/lib/db/queries';
import { generateTitle } from '@/lib/ai/utils/generate-title';
import { getLogger } from '@/lib/logger';
import {
  generateAIText as generateAITextPrompt,
  generateChatTitle,
} from '@/lib/ai/prompts/builders/specialized/title-builder';

const logger = getLogger('ChatActions');

/**
 * Generate AI-assisted text with anti-hallucination guardrails
 *
 * Server action for AIAssistedTextInput component
 * System prompt is hardcoded here to enforce guardrails
 *
 * @param instruction - What kind of text to generate
 * @param context - Available context data
 * @returns Generated text
 */
export async function generateAIText(
  instruction: string,
  context: Record<string, string | number | boolean | string[]>,
): Promise<string> {
  try {
    // Build user prompt from instruction and context
    const contextStr = Object.entries(context)
      .filter(([_, value]) => value !== undefined && value !== null)
      .map(([key, value]) => `${key}: ${value}`)
      .join('\n');

    const userPrompt = contextStr
      ? `${instruction}\n\nContext:\n${contextStr}\n\nIMPORTANT: Match output detail to input detail. Do NOT invent details not provided in context.`
      : `${instruction}\n\nIMPORTANT: No context provided. Keep output generic and helpful.`;

    logger.debug('Generating AI text', {
      instruction,
      contextKeys: Object.keys(context),
      promptLength: userPrompt.length,
    });

    const text = await generateTitle({
      context: {},
      systemPrompt: generateAITextPrompt(),
      userPrompt,
      maxLength: 500,
      temperature: 0.3,
    });

    logger.info('AI text generated', {
      outputLength: text.length,
    });

    return text;
  } catch (error) {
    logger.error('AI text generation failed', error);
    throw new Error('Failed to generate text');
  }
}

export async function generateTitleFromUserMessage({
  message,
}: {
  message: UIMessage;
}) {
  return generateTitle({
    context: {
      message: JSON.stringify(message),
    },
    systemPrompt: generateChatTitle(80),
    userPrompt: '{message}',
    maxLength: 80,
  });
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
