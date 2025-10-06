/**
 * Base utilities for document handlers
 * These functions extract the common patterns across all document types
 * while allowing each handler to maintain its own prompts and configuration
 */

import { streamText, smoothStream } from 'ai';
import { createDocument, getPublishedDocumentById } from '@/lib/db/documents';
import type { LanguageModel, UIMessageStreamWriter } from 'ai';
import type { ChatMessage } from '@/lib/types';
import type { ArtifactKind } from '@/components/artifact';
import type { AnthropicProviderOptions } from '@ai-sdk/anthropic';
import { getSystemPromptHeader } from '@/lib/ai/prompts/system';

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
  temperature?: number;
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
 * Returns the created document with version ID for message linking
 */
export async function saveGeneratedDocument(
  content: string,
  props: SaveDocumentProps,
): Promise<{ envelopeId: string; versionId: string } | null> {
  if (props.session?.user?.id) {
    // Use new envelope/version schema
    const doc = await createDocument({
      id: props.id, // Use pre-generated ID from tool
      title: props.title,
      content,
      messageId: null, // NULL: Will be linked to assistant message in onFinish callback
      workspaceId: props.workspaceId,
      userId: props.session.user.id,
      documentType: props.metadata?.documentType as string | undefined,
      kind: props.kind,
      metadata: props.metadata,
    });

    // createDocument always creates initial draft, so currentDraft should never be null
    if (!doc.currentDraft) {
      throw new Error('Failed to create initial draft version');
    }

    return {
      envelopeId: doc.envelope.id,
      versionId: doc.currentDraft.id,
    };
  }
  return null;
}

/**
 * Fetch and combine source documents for types that require source content
 * Supports optional primary document distinction for analysis types
 * Returns empty string if no source documents provided
 */
export async function fetchSourceDocuments(
  sourceDocumentIds: string[] | undefined,
  workspaceId: string,
): Promise<string>;

export async function fetchSourceDocuments(
  sourceDocumentIds: string[] | undefined,
  workspaceId: string,
  primaryDocumentId: string,
): Promise<{
  primaryDocument: string;
  supportingDocuments: string;
}>;

export async function fetchSourceDocuments(
  sourceDocumentIds: string[] | undefined,
  workspaceId: string,
  primaryDocumentId?: string,
): Promise<string | { primaryDocument: string; supportingDocuments: string }> {
  // If primaryDocumentId specified, ensure it's in the fetch list
  let docIdsToFetch = sourceDocumentIds || [];

  if (primaryDocumentId) {
    // Always fetch primary, add to list if not present
    if (!docIdsToFetch.includes(primaryDocumentId)) {
      docIdsToFetch = [primaryDocumentId, ...docIdsToFetch];
    }
  }

  if (!docIdsToFetch.length) {
    if (primaryDocumentId) {
      return { primaryDocument: '', supportingDocuments: '' };
    }
    return '';
  }

  // Fetch all source documents in parallel (only published versions)
  const sourceDocuments = await Promise.all(
    docIdsToFetch.map((docId) => getPublishedDocumentById(docId, workspaceId)),
  );

  // Filter out null/undefined documents
  const validDocuments = sourceDocuments.filter(
    (doc): doc is NonNullable<typeof doc> =>
      doc !== null && doc?.content !== null && doc?.content !== undefined,
  );

  if (validDocuments.length === 0) {
    if (primaryDocumentId) {
      return { primaryDocument: '', supportingDocuments: '' };
    }
    return '';
  }

  // If primaryDocumentId specified, separate primary from supporting
  if (primaryDocumentId) {
    const primaryDoc = validDocuments.find(
      (doc) => doc.id === primaryDocumentId,
    );
    // Remove primary from supporting docs list
    const supportingDocs = validDocuments.filter(
      (doc) => doc.id !== primaryDocumentId,
    );

    return {
      primaryDocument: primaryDoc
        ? `--- ${primaryDoc.title} ---\n${primaryDoc.content}`
        : '',
      supportingDocuments:
        supportingDocs.length > 0
          ? supportingDocs
              .map((doc) => `--- ${doc.title} ---\n${doc.content}`)
              .join('\n\n')
          : '',
    };
  }

  // Backward compatible: combine all documents
  return validDocuments
    .map((doc) => `--- ${doc.title} ---\n${doc.content}`)
    .join('\n\n');
}

/**
 * Compose system prompt from instructions and template
 * Standard pattern for all document types
 */
export function composeSystemPrompt(
  instructions: string,
  template: string,
  sectionHeader = 'Output Format',
): string {
  if (!template) {
    return instructions;
  }
  return `${instructions}\n\n## ${sectionHeader}\n${template}`;
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
  temperature = 0.6,
  prediction,
}: {
  model: LanguageModel;
  system: string;
  prompt: string;
  maxOutputTokens?: number;
  thinkingBudget?: number;
  temperature?: number;
  prediction?: string;
}): StreamConfig {
  // Prepend system prompt header with current date context
  const systemWithContext = `${getSystemPromptHeader()}\n\n${system}`;

  const config: StreamConfig = {
    model,
    system: systemWithContext,
    prompt,
    maxOutputTokens,
    temperature,
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
