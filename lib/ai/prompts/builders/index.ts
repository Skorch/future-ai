/**
 * Prompt Builder System
 * Central export barrel for all builders and factories
 */

// Factories
export { createAgentBuilder } from './factories/agent-builder-factory';

// Agent Builders (MODE system removed - now unified)
export { UnifiedAgentBuilder } from './agents/unified-agent-builder';

// Category Builders (generic, database-driven)
export { ObjectiveDocumentBuilder } from './objective-document-builder';
export { SummaryBuilder } from './summary-builder';
export { PunchlistBuilder } from './punchlist-builder';

// Specialized Builders
export { WorkspaceContextBuilder } from './specialized/workspace-context-builder';
export { ObjectiveContextBuilder } from './specialized/objective-context-builder';
export {
  generateChatTitle,
  generateAIText,
  generateKnowledgeMetadata,
  generateObjectiveTitle,
} from './specialized/title-builder';

// Type exports
export type { AgentBuilder } from './factories/agent-builder-factory';
export type { DocumentBuilder, KnowledgeBuilder } from './types';
