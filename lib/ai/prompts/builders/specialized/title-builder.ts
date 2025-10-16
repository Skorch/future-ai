/**
 * Title Builder
 * Generates system prompts for title generation
 */

import {
  CHAT_TITLE_GENERATION_SYSTEM_PROMPT,
  KNOWLEDGE_DOCUMENT_METADATA_SYSTEM_PROMPT,
  OBJECTIVE_DOCUMENT_TITLE_SYSTEM_PROMPT,
} from '../shared/prompts/generation/title.prompts';

export class TitleBuilder {
  /**
   * Generate chat title prompt
   */
  generateChatTitle(maxLength = 80): string {
    return CHAT_TITLE_GENERATION_SYSTEM_PROMPT.replace(
      '{maxLength}',
      maxLength.toString(),
    );
  }

  /**
   * Generate knowledge document metadata prompt
   */
  generateKnowledgeMetadata(maxTitleLength = 100): string {
    return KNOWLEDGE_DOCUMENT_METADATA_SYSTEM_PROMPT(maxTitleLength);
  }

  /**
   * Generate objective document title prompt
   */
  generateObjectiveDocumentTitle(maxLength = 100): string {
    return OBJECTIVE_DOCUMENT_TITLE_SYSTEM_PROMPT.replace(
      '{maxLength}',
      maxLength.toString(),
    );
  }
}
