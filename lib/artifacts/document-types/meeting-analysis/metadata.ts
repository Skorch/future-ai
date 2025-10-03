import type { ArtifactMetadata } from '@/lib/artifacts/types';
import { ThinkingBudget } from '@/lib/artifacts/types';
import { MEETING_ANALYSIS_PROMPT, MEETING_ANALYSIS_TEMPLATE } from './prompts';

export const metadata: ArtifactMetadata = {
  type: 'meeting-analysis',
  name: 'Meeting Analysis',
  description:
    'Two-tier project tracking: executive dashboard + initiative progression with Past→Present→Future accountability framework',
  clientKind: 'text',
  icon: 'TrendingUp',

  // Prompt and template content
  prompt: MEETING_ANALYSIS_PROMPT,
  template: MEETING_ANALYSIS_TEMPLATE,

  // Agent guidance for when to use this artifact type
  agentGuidance: {
    when: 'User uploads meeting transcripts or notes requiring project/product progress tracking and accountability analysis',
    triggers: [
      'project meeting',
      'product meeting',
      'team sync',
      'sprint review',
      'stakeholder meeting',
      'planning meeting',
      'status update',
      'progress meeting',
      'initiative review',
      'project update',
      '.vtt',
      '.txt',
      'transcript',
      'meeting notes',
    ],
    examples: [
      'Analyze this project meeting transcript',
      'Create a progress analysis from this team sync',
      'Track initiative status from this meeting',
      'Show project progression from these meeting notes',
      'Generate accountability report from this status update',
    ],
  },

  // Parameters configuration
  requiredParams: ['sourceDocumentIds'],
  optionalParams: [
    'primarySourceDocumentId',
    'meetingDate',
    'participants',
    'projectName',
    'previousMeetingIds',
  ],

  // Generation configuration
  outputSize: 2200, // Matching sales-analysis for two-tier efficiency
  thinkingBudget: ThinkingBudget.MEDIUM, // 8000 tokens for progression analysis
  temperature: 0.3, // Low temperature for factual, consistent tracking

  // RAG configuration
  chunkingStrategy: 'section-based', // Use section-based chunking for meeting summaries
};
