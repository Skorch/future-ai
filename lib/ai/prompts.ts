// Re-export core components from new structure
export {
  composeSystemPrompt,
  getRequestPromptFromHints,
  SYSTEM_PROMPT_BASE,
  type RequestHints,
} from './prompts/system';

export { MEETING_INTELLIGENCE_PROMPT } from './prompts/domains/meeting-intelligence';

// Legacy export for backward compatibility - will be removed after migration
export { MEETING_INTELLIGENCE_PROMPT as meetingIntelligencePrompt } from './prompts/domains/meeting-intelligence';

// DEPRECATED: Use composeSystemPrompt from './prompts/system' instead
// This function is kept temporarily for backward compatibility
import type { RequestHints } from './prompts/system';
import { composeSystemPrompt } from './prompts/system';
import { MEETING_INTELLIGENCE_PROMPT } from './prompts/domains/meeting-intelligence';

export const systemPrompt = ({
  requestHints,
}: {
  selectedChatModel?: string; // Deprecated parameter, ignored
  requestHints: RequestHints;
}) => {
  console.warn(
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
    console.warn(
      `Document type '${type}' is no longer supported. Treating as text.`,
    );
  }

  return `\
Improve the following contents of the document based on the given prompt.

${currentContent}
`;
};

// Specialized prompt for transcript summary generation
// This is used by artifacts/meeting-summary for document generation
export const transcriptSummaryPrompt = `
Generate a structured meeting summary from this transcript. Follow this EXACT format:

# Meeting Summary: [Create descriptive title based on main topics]
**Date:** [Extract date or use today's date]
**Participants:** [List all speakers identified]
**Duration:** [Calculate from timestamps or estimate]

## Executive Overview
[2-3 sentences capturing the essence of the meeting]

## Topic: [Identify first major discussion topic]
[Detailed bullet points about this topic, including:]
- Key points discussed with specific details
- Any decisions made about this topic
- **Action:** [Specific action items with owner]
- Notable quotes or important statements

## Topic: [Second major topic]
[Continue same pattern]

[Add 3-7 total topic sections based on transcript content]

## Key Decisions
[Number each decision clearly with context]

## Action Items
[Table format with Owner, Task, Due Date]

## Next Meeting
[Only if mentioned in transcript]

IMPORTANT:
- Use "## Topic:" prefix for all discussion topics
- Be specific and detailed in topic names
- Extract actual content, not generic summaries
- Include speaker attributions where relevant
`;
