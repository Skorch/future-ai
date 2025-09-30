// Re-export core components from new structure
export {
  composeSystemPrompt,
  getRequestPromptFromHints,
  SYSTEM_PROMPT_BASE,
  type RequestHints,
} from './prompts/system';

// DEPRECATED: Use composeSystemPrompt from './prompts/system' instead
// This function is kept temporarily for backward compatibility
import type { RequestHints } from './prompts/system';
import { composeSystemPrompt } from './prompts/system';
import { MEETING_INTELLIGENCE_PROMPT } from './prompts/domains/meeting-intelligence';
import { getLogger } from '@/lib/logger';

const logger = getLogger('prompts');

export const systemPrompt = ({
  requestHints,
}: {
  selectedChatModel?: string; // Deprecated parameter, ignored
  requestHints: RequestHints;
}) => {
  logger.warn(
    'DEPRECATED: systemPrompt() is deprecated. Use composeSystemPrompt() instead.',
  );
  return composeSystemPrompt({
    requestHints,
    domainPrompts: [MEETING_INTELLIGENCE_PROMPT],
  });
};

// Document update prompt - simplified without code/sheet support
export const updateDocumentPrompt = (
  currentContent: string | null,
  type: 'text' | 'code' | 'sheet', // Keep signature for compatibility
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
