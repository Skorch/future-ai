/**
 * Prompt layer sources - where the content comes from
 */
export type LayerSource =
  | 'core' // CORE_SYSTEM_PROMPT (hardcoded)
  | 'currentContext' // getCurrentContext() (dynamic)
  | 'domain' // Domain.systemPrompt (database)
  | 'streaming' // STREAMING_AGENT_PROMPT (hardcoded, includes playbook)
  | 'artifactType' // ArtifactType.instructionPrompt (database)
  | 'template' // ArtifactType.template (database)
  | 'workspaceContext' // Workspace.context (database)
  | 'objectiveContext'; // Objective.objectiveGoal (database)

/**
 * Configuration for a single layer in the prompt stack
 */
export interface LayerConfig {
  source: LayerSource;
  label: string; // User-friendly name (e.g., "Domain Intelligence")
  dbField?: string; // DB reference (e.g., "Domain.systemPrompt")
  editable: boolean; // Can this layer be edited?
  required: boolean; // Is this layer always present?
}

/**
 * Scenario IDs for different prompt composition use cases
 */
export type ScenarioId =
  | 'workspace-context'
  | 'objective-context'
  | 'objective-document'
  | 'knowledge-summary'
  | 'objectiveActions'
  | 'chat-message';

/**
 * Scenario definition for prompt editing
 */
export interface Scenario {
  id: ScenarioId;
  label: string;
  description: string;
  requiresDomain: boolean;
  requiresArtifactType: boolean;
  artifactCategory?: 'objective' | 'summary' | 'objectiveActions' | 'context';
  layers: LayerConfig[];
}

/**
 * The 6 scenarios from the spec
 */
export const SCENARIOS: Scenario[] = [
  {
    id: 'workspace-context',
    label: 'Workspace Context Prompt',
    description: 'Generate workspace-level context summary',
    requiresDomain: true,
    requiresArtifactType: false,
    artifactCategory: 'context',
    layers: [
      { source: 'core', label: 'Core System', editable: false, required: true },
      {
        source: 'currentContext',
        label: 'Current Context',
        editable: false,
        required: true,
      },
      {
        source: 'domain',
        label: 'Domain Intelligence',
        dbField: 'Domain.systemPrompt',
        editable: true,
        required: true,
      },
      {
        source: 'artifactType',
        label: 'Context Instructions',
        dbField: 'ArtifactType.instructionPrompt',
        editable: true,
        required: true,
      },
    ],
  },
  {
    id: 'objective-context',
    label: 'Objective Context Prompt',
    description: 'Generate objective-level context summary',
    requiresDomain: true,
    requiresArtifactType: false,
    artifactCategory: 'context',
    layers: [
      { source: 'core', label: 'Core System', editable: false, required: true },
      {
        source: 'currentContext',
        label: 'Current Context',
        editable: false,
        required: true,
      },
      {
        source: 'domain',
        label: 'Domain Intelligence',
        dbField: 'Domain.systemPrompt',
        editable: true,
        required: true,
      },
      {
        source: 'artifactType',
        label: 'Context Instructions',
        dbField: 'ArtifactType.instructionPrompt',
        editable: true,
        required: true,
      },
    ],
  },
  {
    id: 'objective-document',
    label: 'Objective Document Creation',
    description:
      'Generate objective document (e.g., Sales Strategy, Business Requirements)',
    requiresDomain: true,
    requiresArtifactType: true,
    artifactCategory: 'objective',
    layers: [
      { source: 'core', label: 'Core System', editable: false, required: true },
      {
        source: 'currentContext',
        label: 'Current Context',
        editable: false,
        required: true,
      },
      {
        source: 'streaming',
        label: 'Streaming Agent Capabilities',
        editable: false,
        required: true,
      },
      {
        source: 'domain',
        label: 'Domain Intelligence',
        dbField: 'Domain.systemPrompt',
        editable: true,
        required: true,
      },
      {
        source: 'artifactType',
        label: 'Document Instructions',
        dbField: 'ArtifactType.instructionPrompt',
        editable: true,
        required: true,
      },
      {
        source: 'template',
        label: 'Document Template',
        dbField: 'ArtifactType.template',
        editable: true,
        required: false,
      },
      {
        source: 'workspaceContext',
        label: 'Workspace Context',
        editable: false,
        required: false,
      },
      {
        source: 'objectiveContext',
        label: 'Objective Context',
        editable: false,
        required: false,
      },
    ],
  },
  {
    id: 'knowledge-summary',
    label: 'Knowledge Doc Summary',
    description: 'Generate summary from transcript/meeting notes',
    requiresDomain: true,
    requiresArtifactType: true,
    artifactCategory: 'summary',
    layers: [
      { source: 'core', label: 'Core System', editable: false, required: true },
      {
        source: 'currentContext',
        label: 'Current Context',
        editable: false,
        required: true,
      },
      {
        source: 'streaming',
        label: 'Streaming Agent Capabilities',
        editable: false,
        required: true,
      },
      {
        source: 'domain',
        label: 'Domain Intelligence',
        dbField: 'Domain.systemPrompt',
        editable: true,
        required: true,
      },
      {
        source: 'artifactType',
        label: 'Summary Instructions',
        dbField: 'ArtifactType.instructionPrompt',
        editable: true,
        required: true,
      },
    ],
  },
  {
    id: 'objectiveActions',
    label: 'Objective Actions Creation',
    description: 'Generate objective actions from objective document',
    requiresDomain: true,
    requiresArtifactType: true,
    artifactCategory: 'objectiveActions',
    layers: [
      { source: 'core', label: 'Core System', editable: false, required: true },
      {
        source: 'currentContext',
        label: 'Current Context',
        editable: false,
        required: true,
      },
      {
        source: 'streaming',
        label: 'Streaming Agent Capabilities',
        editable: false,
        required: true,
      },
      {
        source: 'domain',
        label: 'Domain Intelligence',
        dbField: 'Domain.systemPrompt',
        editable: true,
        required: true,
      },
      {
        source: 'artifactType',
        label: 'Objective Actions Instructions',
        dbField: 'ArtifactType.instructionPrompt',
        editable: true,
        required: true,
      },
      {
        source: 'template',
        label: 'Objective Actions Template',
        dbField: 'ArtifactType.template',
        editable: true,
        required: false,
      },
    ],
  },
  {
    id: 'chat-message',
    label: 'Chat Message (General)',
    description: 'General chat interaction with AI agent',
    requiresDomain: true,
    requiresArtifactType: false,
    layers: [
      { source: 'core', label: 'Core System', editable: false, required: true },
      {
        source: 'currentContext',
        label: 'Current Context',
        editable: false,
        required: true,
      },
      {
        source: 'domain',
        label: 'Domain Intelligence',
        dbField: 'Domain.systemPrompt',
        editable: true,
        required: true,
      },
      {
        source: 'streaming',
        label: 'Streaming Agent Capabilities',
        editable: false,
        required: true,
      },
      {
        source: 'workspaceContext',
        label: 'Workspace Context',
        editable: false,
        required: false,
      },
      {
        source: 'objectiveContext',
        label: 'Objective Context',
        editable: false,
        required: false,
      },
    ],
  },
];
