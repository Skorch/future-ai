import {
  OutputSize,
  ThinkingBudget,
  type ArtifactMetadata,
} from '@/lib/artifacts/types';

export const metadata: ArtifactMetadata = {
  type: 'meeting-agenda',
  name: 'Meeting Agenda',
  description:
    'Pre-meeting preparation with structured agenda, topics, and time allocation',
  clientKind: 'text',
  icon: 'Calendar',

  prompt:
    'Create a structured meeting agenda based on the topics and objectives provided',
  template: '', // Will be defined in prompts.ts

  agentGuidance: {
    when: 'User needs to prepare for an upcoming meeting or wants to structure discussion topics',
    triggers: [
      'meeting agenda',
      'prepare agenda',
      'agenda template',
      'meeting prep',
      'meeting planning',
    ],
    examples: [
      'Create an agenda for our quarterly review meeting',
      "Prepare an agenda for tomorrow's product planning session",
      'Generate a meeting agenda for the stakeholder update',
    ],
  },

  requiredParams: [],
  optionalParams: ['meetingTitle', 'duration', 'attendees', 'objectives'],

  outputSize: OutputSize.SMALL,
  thinkingBudget: ThinkingBudget.LOW, // For better time allocation and structure planning

  chunkingStrategy: 'section-based', // Use section-based chunking for agendas
};
