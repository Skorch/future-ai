import type { ModeConfig } from './types';
import { BUILD_MODE_PROMPT } from '@/lib/ai/prompts/modes/build';

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
    'setMode',
    'setComplete', // Allow marking task complete in any mode
  ],

  temperature: 0.7, // More creative for building
};
