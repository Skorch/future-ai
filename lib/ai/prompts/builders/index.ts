/**
 * Prompt Builder System
 * Central export barrel for all builders and factories
 */

// Factories
export { createAgentBuilder } from './factories/agent-builder-factory';
export { createDocumentBuilder } from './factories/document-builder-factory';

// Agent Builders
export { DiscoveryAgentBuilder } from './agents/discovery-agent-builder';
export { BuildAgentBuilder } from './agents/build-agent-builder';

// Document Builders (only registered artifact types)
export { SalesStrategyDocumentBuilder } from './documents/sales-strategy-builder';
export { BusinessRequirementsDocumentBuilder } from './documents/business-requirements-builder';
// Note: Summary builders will be exported when they're added to artifact registry
// export { SalesCallSummaryDocumentBuilder } from './documents/sales-call-summary-builder';
// export { RequirementsMeetingSummaryDocumentBuilder } from './documents/requirements-meeting-summary-builder';

// Specialized Builders
export { WorkspaceContextBuilder } from './specialized/workspace-context-builder';
export { ObjectiveContextBuilder } from './specialized/objective-context-builder';
export { TitleBuilder } from './specialized/title-builder';

// Type exports
export type { AgentBuilder } from './factories/agent-builder-factory';
export type { DocumentBuilder } from './factories/document-builder-factory';
