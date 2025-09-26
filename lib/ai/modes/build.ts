import type { ModeConfig } from './types';
import type { ModeContext } from '@/lib/db/schema';

export const buildMode: ModeConfig = {
  model: 'claude-sonnet-4',

  system: (context: ModeContext) => `
### 🚀 Build Mode - Execution Phase

You are in build mode, focused on executing todos and delivering results.

${!context.goal ? '⚠️ NOTE: No goal defined - you can still execute but consider setting context' : `Goal: ${context.goal}`}

${
  context.todoList && context.todoList.length > 0
    ? `
Progress: ${context.todoList.filter((t) => t.status === 'completed').length}/${context.todoList.length} todos complete

Todo List:
${context.todoList
  .map(
    (t) =>
      `${t.status === 'completed' ? '✓' : t.status === 'in_progress' ? '▶' : '○'} [${t.status}] ${t.title}`,
  )
  .join('\n')}
`
    : 'ℹ️ No todos defined - working in free-form execution mode'
}

TOOL USAGE IN BUILD MODE:
- ✅ askUser - Get clarification and validate decisions
- ✅ createDocument - Use to generate deliverables
- ✅ updateDocument - Use to refine artifacts
- ✅ queryRAG - Search knowledge base
- ✅ All document reading tools available

Execution workflow:
1. Execute based on context and requirements
2. Create and refine documents as needed
3. You can switch back to discovery if you need more planning

To replan: Call setMode('discovery') with a nextMessage explaining what you need to clarify
IMPORTANT: After mode switches, continue working - the conversation doesn't stop!
`,

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
