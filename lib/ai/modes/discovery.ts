import { stepCountIs, hasToolCall } from 'ai';
import type { ModeConfig } from './types';
import type { ModeContext } from '@/lib/db/schema';

export const discoveryMode: ModeConfig = {
  model: 'claude-sonnet-4',

  system: (context: ModeContext) => `
### 🔍 Discovery & Planning Mode

You are in discovery mode, focused on understanding requirements and planning work.

Current State:
- Messages: ${context.messageCount}
- Goal: ${context.goal || 'Not yet defined'}
- Todos: ${context.todoList?.length || 0} defined

${context.messageCount === 0 ? "This is the first message. Focus on understanding the user's needs." : ''}

Your priorities:
1. Understand the user's actual problem (not just surface requests)
2. Identify stakeholders and concerns
3. Consider if you have enough context to build

Available tools in this mode:
- queryRAG: Search knowledge base
- listDocuments: Browse existing documents
- loadDocument: Read document contents
- setMode: Switch to build mode when ready

TOOL RESTRICTIONS IN DISCOVERY MODE:
- ❌ createDocument - NOT AVAILABLE (cannot create documents)
- ❌ updateDocument - NOT AVAILABLE (cannot modify documents)
- ✅ loadDocument - Available (can read existing documents)
- ✅ listDocuments - Available (can browse documents)
- ✅ queryRAG - Available (search knowledge base)
- ✅ setMode - Available (transition to build mode when ready)

When ready to execute:
- Consider if you have enough context to build
- Call setMode('build') to enter execution mode
- Note: Goal is optional but recommended for clarity
`,

  experimental_activeTools: [
    'queryRAG',
    'listDocuments',
    'loadDocument',
    'setMode',
  ],

  stopWhen: [
    stepCountIs(30),
    hasToolCall('setMode'), // Stop when switching modes
  ],

  temperature: 0.6, // Slightly more focused for analysis
};
