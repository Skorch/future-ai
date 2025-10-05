import type { ModeConfig } from './types';
import { DISCOVERY_MODE_PROMPT } from '@/lib/ai/prompts/modes/discovery';
import { ThinkingBudget } from '@/lib/ai/types';

export const discoveryMode: ModeConfig = {
  model: 'claude-sonnet-4',

  system: DISCOVERY_MODE_PROMPT,

  experimental_activeTools: [
    'askUser',
    'queryRAG',
    'listDocuments',
    'loadDocument',
    'getPlaybook', // Retrieve structured playbook workflows
    'setMode',
    'setComplete', // Allow marking task complete in any mode
  ],

  temperature: 0.4, // Slightly more focused for analysis
  thinkingBudget: ThinkingBudget.MEDIUM, // Standard analysis for discovery
};
