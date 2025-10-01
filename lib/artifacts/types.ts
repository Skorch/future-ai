// Output size configuration for document generation
export enum OutputSize {
  SMALL = 1500, // Brief summaries, quick notes
  MEDIUM = 2500, // Standard documents like meeting memories
  LARGE = 4000, // Comprehensive reports, detailed analysis
  XLARGE = 8000, // Full documentation, extensive content
}

// Thinking budget configuration for document generation
export enum ThinkingBudget {
  NONE = 0, // No thinking process
  LOW = 4000, // Quick analysis
  MEDIUM = 8000, // Standard analysis for complex documents
  HIGH = 12000, // Deep analysis for critical documents
}

// Chunking strategy for RAG indexing
export type ChunkingStrategy = 'ai-transcript' | 'section-based' | 'none';

export interface ArtifactMetadata {
  type: string;
  name: string;
  description: string;
  clientKind: 'text';

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
