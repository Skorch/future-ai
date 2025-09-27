import type { ModeConfig } from './types';
import { DISCOVERY_MODE_PROMPT } from '@/lib/ai/prompts/modes/discovery';

export const discoveryMode: ModeConfig = {
  model: 'claude-sonnet-4',

  system: DISCOVERY_MODE_PROMPT,

  experimental_activeTools: [
    'askUser',
    'queryRAG',
    'listDocuments',
    'loadDocument',
    'setMode',
    'setComplete', // Allow marking task complete in any mode
  ],

  temperature: 0.6, // Slightly more focused for analysis
};
