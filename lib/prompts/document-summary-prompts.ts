import {
  RAW_DOCUMENT_TYPES,
  type RawDocumentType,
} from '@/lib/db/types/document-types';

/**
 * Structure for type-specific summary instructions
 */
export interface DocumentSummaryPrompt {
  instruction: string;
  focusAreas: string[];
}

/**
 * Type-specific prompts for AI summary generation
 *
 * When users request summaries of raw documents, these prompts guide
 * the AI to extract the most relevant information based on document type.
 *
 * Used in Phase 4 chat integration when creating summaries.
 */
export const DOCUMENT_SUMMARY_PROMPTS: Record<
  RawDocumentType,
  DocumentSummaryPrompt
> = {
  [RAW_DOCUMENT_TYPES.TRANSCRIPT]: {
    instruction:
      'Analyze this transcript and provide a comprehensive summary covering key discussion points, decisions made, and action items.',
    focusAreas: [
      'Main topics and themes discussed',
      'Key decisions or conclusions reached',
      'Action items with assigned owners and deadlines (when mentioned)',
      'Important quotes or insights',
      'Questions, concerns, or unresolved issues',
      'Next steps or follow-up items',
    ],
  },

  [RAW_DOCUMENT_TYPES.EMAIL]: {
    instruction:
      'Summarize this email thread, highlighting the main request, responses, and any action items or decisions.',
    focusAreas: [
      'Primary purpose of the email/thread',
      'Key requests, questions, or concerns',
      'Responses and agreements reached',
      'Action items with assigned owners and deadlines (when mentioned)',
      'Unresolved issues or pending decisions',
      'Important attachments or references',
    ],
  },

  [RAW_DOCUMENT_TYPES.SLACK]: {
    instruction:
      'Summarize this Slack conversation, extracting key information, decisions, and follow-up items.',
    focusAreas: [
      'Main discussion topics and context',
      'Decisions or agreements reached',
      'Action items identified',
      'Links, resources, or files shared',
      'Open questions or blockers',
      'Participants and their key contributions',
    ],
  },

  [RAW_DOCUMENT_TYPES.MEETING_NOTES]: {
    instruction:
      'Analyze these meeting notes and create a structured summary of discussions, decisions, and action items.',
    focusAreas: [
      'Meeting objectives and outcomes',
      'Key discussion points and topics covered',
      'Decisions made with rationale',
      'Action items with assigned owners and deadlines (when mentioned)',
      'Next steps and follow-up meetings',
      'Important context or background information',
    ],
  },

  [RAW_DOCUMENT_TYPES.RESEARCH]: {
    instruction:
      'Summarize this research document, highlighting key findings, methodologies, and implications.',
    focusAreas: [
      'Research objectives and questions',
      'Key findings and insights',
      'Methodologies or approaches used',
      'Data sources and evidence',
      'Implications and recommendations',
      'Limitations, gaps, or areas for further research',
    ],
  },

  [RAW_DOCUMENT_TYPES.OTHER]: {
    instruction:
      'Analyze this document and provide a clear, structured summary of its main content and key points.',
    focusAreas: [
      'Main purpose and content type',
      'Key points or findings',
      'Important details and context',
      'Relevant information for the reader',
      'Notable insights or takeaways',
      'Any actionable items or recommendations',
    ],
  },
};

/**
 * Get summary prompt configuration for a document type
 */
export function getSummaryPromptForType(
  type: RawDocumentType,
): DocumentSummaryPrompt {
  return DOCUMENT_SUMMARY_PROMPTS[type];
}

/**
 * Format a summary prompt into a complete instruction string
 *
 * Combines the instruction with formatted focus areas for use in AI prompts
 */
export function formatSummaryPrompt(type: RawDocumentType): string {
  const prompt = DOCUMENT_SUMMARY_PROMPTS[type];
  const focusAreasFormatted = prompt.focusAreas
    .map((area) => `- ${area}`)
    .join('\n');

  return `${prompt.instruction}

Focus on:
${focusAreasFormatted}`;
}

/**
 * Get summary prompt with document content template
 *
 * Returns a complete prompt ready for AI with placeholders for content
 */
export function buildSummaryPromptWithContent(
  type: RawDocumentType,
  content: string,
  title?: string,
): string {
  const basePrompt = formatSummaryPrompt(type);

  return `${basePrompt}

${title ? `**Document Title:** ${title}\n\n` : ''}**Document Content:**

${content}`;
}
