// Re-export core components from new structure
export {
  composeSystemPrompt,
  getSystemPromptHeader,
  SYSTEM_PROMPT_BASE,
} from './prompts/system';

// Note: systemPrompt function has been removed. Use composeSystemPrompt() from './prompts/system' instead.
import { getLogger } from '@/lib/logger';

const logger = getLogger('prompts');

// Document update prompt - simplified without code/sheet support
export const updateDocumentPrompt = (
  currentContent: string | null,
  type: 'text', // Only text is supported
) => {
  // Only support text documents now
  if (type !== 'text') {
    logger.warn(
      `Document type '${type}' is no longer supported. Treating as text.`,
    );
  }

  return `\
Improve the following contents of the document based on the given prompt.

${currentContent}
`;
};
