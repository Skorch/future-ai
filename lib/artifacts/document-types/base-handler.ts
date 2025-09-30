/**
 * Base utilities for document handlers
 * These functions extract the common patterns across all document types
 * while allowing each handler to maintain its own prompts and configuration
 */

import { streamText, smoothStream } from 'ai';
import { getDocumentById, saveDocument } from '@/lib/db/queries';
import type { LanguageModel, UIMessageStreamWriter } from 'ai';
import type { ChatMessage } from '@/lib/types';
import type { ArtifactKind } from '@/components/artifact';
import type { AnthropicProviderOptions } from '@ai-sdk/anthropic';

/**
 * Provider options type for AI models
 */
type ProviderOptions = {
  anthropic?: AnthropicProviderOptions;
  openai?: {
    prediction?: {
      type: 'content';
      content: string;
    };
  };
};

/**
 * Configuration for streaming text generation
 */
export interface StreamConfig {
  model: LanguageModel;
  system: string;
  prompt: string;
  maxOutputTokens?: number;
  experimental_transform?: ReturnType<typeof smoothStream>;
  providerOptions?: ProviderOptions;
}

/**
 * Document metadata type
 */
type DocumentMetadata = {
  documentType?: string;
  sourceDocumentIds?: string[];
  meetingDate?: string;
  participants?: string[];
  [key: string]: unknown;
};

/**
 * Properties needed to save a document
 */
export interface SaveDocumentProps {
  id: string;
  title: string;
  kind: ArtifactKind;
  session: { user?: { id: string } } | undefined;
  workspaceId: string;
  metadata?: DocumentMetadata;
}

/**
 * Process a stream of text from the AI model and write deltas to the data stream
 * Returns the complete accumulated content
 */
export async function processStream(
  config: StreamConfig,
  dataStream: UIMessageStreamWriter<ChatMessage>,
): Promise<string> {
  let content = '';

  const { fullStream } = streamText(config);

  for await (const delta of fullStream) {
    const { type } = delta;

    if (type === 'text-delta') {
      const { text } = delta;
      content += text;

      dataStream.write({
        type: 'data-textDelta',
        data: text,
        transient: true,
      });
    }
  }

  return content;
}

/**
 * Save generated document content to the database
 */
export async function saveGeneratedDocument(
  content: string,
  props: SaveDocumentProps,
): Promise<void> {
  if (props.session?.user?.id) {
    await saveDocument({
      id: props.id,
      title: props.title,
      content,
      kind: props.kind,
      userId: props.session.user.id,
      workspaceId: props.workspaceId,
      metadata: props.metadata,
    });
  }
}

/**
 * Fetch and combine source documents for types that need them (e.g., meeting-memory)
 * Returns empty string if no source documents provided
 */
export async function fetchSourceDocuments(
  sourceDocumentIds: string[] | undefined,
  workspaceId: string,
): Promise<string> {
  if (!sourceDocumentIds?.length) {
    return '';
  }

  // Fetch all source documents in parallel
  const sourceDocuments = await Promise.all(
    sourceDocumentIds.map((docId) =>
      getDocumentById({ id: docId, workspaceId }),
    ),
  );

  // Filter out null/undefined documents and combine their content
  const validDocuments = sourceDocuments.filter(
    (doc): doc is NonNullable<typeof doc> =>
      doc?.content !== null && doc?.content !== undefined,
  );

  if (validDocuments.length === 0) {
    return '';
  }

  // Combine documents with clear separators
  return validDocuments
    .map((doc) => `--- ${doc.title} ---\n${doc.content}`)
    .join('\n\n');
}

/**
 * Build stream configuration with thinking budget support
 * Helper for types that need reasoning capabilities
 */
export function buildStreamConfig({
  model,
  system,
  prompt,
  maxOutputTokens,
  thinkingBudget,
  prediction,
}: {
  model: LanguageModel;
  system: string;
  prompt: string;
  maxOutputTokens?: number;
  thinkingBudget?: number;
  prediction?: string;
}): StreamConfig {
  const config: StreamConfig = {
    model,
    system,
    prompt,
    maxOutputTokens,
    experimental_transform: smoothStream({ chunking: 'word' }),
  };

  // Add provider-specific options if needed
  const providerOptions: ProviderOptions = {};

  if (thinkingBudget) {
    providerOptions.anthropic = {
      thinking: {
        type: 'enabled' as const,
        budgetTokens: thinkingBudget,
      },
    };
  }

  if (prediction) {
    providerOptions.openai = {
      prediction: {
        type: 'content' as const,
        content: prediction,
      },
    };
  }

  if (Object.keys(providerOptions).length > 0) {
    config.providerOptions = providerOptions;
  }

  return config;
}
