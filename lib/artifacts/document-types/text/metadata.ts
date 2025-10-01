import type { ArtifactMetadata } from '@/lib/artifacts/types';
import { OutputSize } from '@/lib/artifacts/types';

export const metadata: ArtifactMetadata = {
  type: 'text',
  name: 'Text Document',
  description: 'General purpose document for any text content',
  clientKind: 'text',

  // Prompt and template content
  prompt:
    'Write about the given topic. Markdown is supported. Use headings wherever appropriate.',
  template: '',

  // Agent guidance for when to use this artifact type
  agentGuidance: {
    when: 'User needs a general purpose document or no specific type matches',
    triggers: ['write', 'draft', 'document', 'notes', 'text'],
    examples: [
      'Write a document about...',
      'Draft some notes on...',
      'Create a text document for...',
    ],
  },

  // Parameters configuration
  requiredParams: [],
  optionalParams: [],

  // Generation configuration
  outputSize: OutputSize.LARGE, // 4000 tokens for general text documents (default)

  // RAG configuration
  chunkingStrategy: 'section-based', // Use section-based chunking for text documents
};
