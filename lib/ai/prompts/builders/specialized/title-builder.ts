/**
 * Title Builder
 * Generates system prompts for title generation
 */

import {
  AI_TEXT_GENERATION_SYSTEM_PROMPT,
  CHAT_TITLE_GENERATION_SYSTEM_PROMPT,
  KNOWLEDGE_DOCUMENT_METADATA_SYSTEM_PROMPT,
  OBJECTIVE_DOCUMENT_TITLE_SYSTEM_PROMPT,
} from '../shared/prompts/generation/title.prompts';
import { CORE_SYSTEM_PROMPT } from '../shared/prompts/system.prompts';
import { getCurrentContext } from '@/lib/ai/prompts/current-context';
import type { User } from '@/lib/db/schema';

/**
 * Generate chat title prompt
 */
export function generateChatTitle(
  maxLength = 80,
  user: User | null = null,
): string {
  return `${CORE_SYSTEM_PROMPT}

${getCurrentContext({ user })}

${CHAT_TITLE_GENERATION_SYSTEM_PROMPT.replace('{maxLength}', maxLength.toString())}`;
}

/**
 * Generate AI-assisted text generation prompt
 */
export function generateAIText(user: User | null = null): string {
  return `${CORE_SYSTEM_PROMPT}

${getCurrentContext({ user })}

${AI_TEXT_GENERATION_SYSTEM_PROMPT}`;
}

/**
 * Generate knowledge document metadata prompt
 */
export function generateKnowledgeMetadata(
  maxTitleLength = 100,
  user: User | null = null,
): string {
  return `${CORE_SYSTEM_PROMPT}

${getCurrentContext({ user })}

${KNOWLEDGE_DOCUMENT_METADATA_SYSTEM_PROMPT(maxTitleLength)}`;
}

/**
 * Generate objective document title prompt
 */
export function generateObjectiveTitle(
  maxLength = 100,
  user: User | null = null,
): string {
  return `${CORE_SYSTEM_PROMPT}

${getCurrentContext({ user })}

${OBJECTIVE_DOCUMENT_TITLE_SYSTEM_PROMPT.replace('{maxLength}', maxLength.toString())}`;
}
