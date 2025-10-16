import type { ModeConfig } from './types';
import { DISCOVERY_MODE_PROMPT } from '@/lib/ai/prompts/builders/shared/prompts/modes/discovery.prompts';
import { ThinkingBudget } from '@/lib/ai/types';

export const discoveryMode: ModeConfig = {
  model: 'claude-sonnet-4',

  system: DISCOVERY_MODE_PROMPT,

  experimental_activeTools: [
    'askUser',
    'queryRAG',
    'listDocuments',
    'loadDocument',
    'saveKnowledge', // Phase 3: Knowledge processing
    'updatePunchlist', // Phase 4: Update punchlist from knowledge
    'updateWorkspaceContext', // Update workspace-level persistent context
    'updateObjectiveContext', // Update objective-level persistent context
    'getPlaybook', // Retrieve structured playbook workflows
    'setMode',
    'setComplete', // Allow marking task complete in any mode
  ],

  temperature: 0.4, // Slightly more focused for analysis
  thinkingBudget: ThinkingBudget.MEDIUM, // Standard analysis for discovery
};
