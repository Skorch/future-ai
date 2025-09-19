export interface ArtifactMetadata {
  type: string;
  name: string;
  description: string;
  clientKind: 'text' | 'code' | 'sheet';

  // Prompt and template content
  prompt: string;
  template: string;

  // Agent guidance for when to use this artifact type
  agentGuidance: {
    when: string; // Description of when to use
    triggers: string[]; // Keywords that suggest this type
    examples: string[]; // Example user requests
  };

  // Parameters configuration
  requiredParams?: string[];
  optionalParams?: string[];
}

import type { DocumentHandler } from './server';

export interface ArtifactDefinition {
  metadata: ArtifactMetadata;
  handler: DocumentHandler;
}
