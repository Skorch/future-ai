import type { ArtifactMetadata } from '@/lib/artifacts/types';
import { MEETING_SUMMARY_PROMPT, MEETING_SUMMARY_TEMPLATE } from './prompts';

export const metadata: ArtifactMetadata = {
  type: 'meeting-summary',
  name: 'Meeting Summary',
  description:
    'Structured summary of meeting transcripts with action items and key decisions',
  clientKind: 'text',

  // Prompt and template content
  prompt: MEETING_SUMMARY_PROMPT,
  template: MEETING_SUMMARY_TEMPLATE,

  // Agent guidance for when to use this artifact type
  agentGuidance: {
    when: 'User uploads transcript files (.vtt, .txt) or asks to summarize meetings',
    triggers: [
      '.vtt',
      '.txt',
      'transcript',
      'meeting notes',
      'summarize meeting',
      'meeting summary',
    ],
    examples: [
      'Summarize this meeting',
      'Create meeting notes from this transcript',
      'Extract action items from this transcript',
      'Generate a meeting summary',
    ],
  },

  // Parameters configuration
  requiredParams: ['sourceDocumentIds'],
  optionalParams: ['meetingDate', 'participants'],
};
