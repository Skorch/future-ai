import type { ModeConfig } from './types';
import { BUILD_MODE_PROMPT } from '@/lib/ai/prompts/modes/build';
import { ThinkingBudget } from '@/lib/ai/types';

export const buildMode: ModeConfig = {
  model: 'claude-sonnet-4',

  system: BUILD_MODE_PROMPT,

  experimental_activeTools: [
    'askUser',
    'queryRAG',
    'listDocuments',
    'loadDocument',
    'loadDocuments',
    'createDocument',
    'updateDocument',
    'getPlaybook', // Retrieve structured playbook workflows
    'setMode',
    'setComplete', // Allow marking task complete in any mode
  ],

  temperature: 0.5, // More creative for building
  thinkingBudget: ThinkingBudget.LOW, // Quick analysis for building documents
};
