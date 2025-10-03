import { OutputSize, ThinkingBudget } from '@/lib/ai/types';

// Re-export for backward compatibility
export { OutputSize, ThinkingBudget };

// Chunking strategy for RAG indexing
export type ChunkingStrategy = 'ai-transcript' | 'section-based' | 'none';

export interface ArtifactMetadata {
  type: string;
  name: string;
  description: string;
  clientKind: 'text';
  icon?: string; // lucide-react icon name for UI display

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

  // Generation configuration
  outputSize?: OutputSize; // Optional, defaults to LARGE if not specified
  thinkingBudget?: ThinkingBudget; // Optional, defaults to NONE if not specified

  // RAG configuration for document chunking strategy
  chunkingStrategy?: ChunkingStrategy; // Defaults to 'section-based' if not specified
}

import type { DocumentHandler } from './server';

export interface ArtifactDefinition {
  metadata: ArtifactMetadata;
  handler: DocumentHandler;
}
