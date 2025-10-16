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

/**
 * Generate chat title prompt
 */
export function generateChatTitle(maxLength = 80): string {
  return CHAT_TITLE_GENERATION_SYSTEM_PROMPT.replace(
    '{maxLength}',
    maxLength.toString(),
  );
}

/**
 * Generate AI-assisted text generation prompt
 */
export function generateAIText(): string {
  return AI_TEXT_GENERATION_SYSTEM_PROMPT;
}

/**
 * Generate knowledge document metadata prompt
 */
export function generateKnowledgeMetadata(maxTitleLength = 100): string {
  return KNOWLEDGE_DOCUMENT_METADATA_SYSTEM_PROMPT(maxTitleLength);
}

/**
 * Generate objective document title prompt
 */
export function generateObjectiveTitle(maxLength = 100): string {
  return OBJECTIVE_DOCUMENT_TITLE_SYSTEM_PROMPT.replace(
    '{maxLength}',
    maxLength.toString(),
  );
}
