import type { ModeConfig } from './types';
import { BUILD_MODE_PROMPT } from '@/lib/ai/prompts/builders/shared/prompts/modes/build.prompts';
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
    'generateDocumentVersion', // Single tool for all document generation
    'updatePunchlist', // Phase 4: Update punchlist from knowledge
    'updateWorkspaceContext', // Update workspace-level persistent context
    'updateObjectiveContext', // Update objective-level persistent context
    'getPlaybook', // Retrieve structured playbook workflows
    'setMode',
    'setComplete', // Allow marking task complete in any mode
  ],

  temperature: 0.5, // More creative for building
  thinkingBudget: ThinkingBudget.LOW, // Quick analysis for building documents
};
