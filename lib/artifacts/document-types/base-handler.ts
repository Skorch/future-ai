/**
 * Base utilities for document handlers
 * These functions extract the common patterns across all document types
 * while allowing each handler to maintain its own prompts and configuration
 */

import {
  streamText,
  smoothStream,
  convertToModelMessages,
  type ModelMessage,
  type LanguageModel,
  type UIMessageStreamWriter,
} from 'ai';
import { getKnowledgeDocumentById } from '@/lib/db/knowledge-document';
import { getObjectiveDocumentById } from '@/lib/db/objective-document';
import { getMessagesByChatId } from '@/lib/db/queries';
import { convertToUIMessages } from '@/lib/utils';
import type { ChatMessage } from '@/lib/types';
import type { AnthropicProviderOptions } from '@ai-sdk/anthropic';
import { CORE_SYSTEM_PROMPT } from '@/lib/ai/prompts/system';
import { getCurrentContext } from '@/lib/ai/prompts/current-context';
import { getStreamingAgentPrompt } from '@/lib/ai/prompts/builders/shared/prompts/unified-agent.prompts';
import { ThinkingStreamProcessor } from '@/lib/ai/utils/thinking-stream-processor';
import { getLogger } from '@/lib/logger';

const logger = getLogger('base-handler');

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
 * Supports both prompt (single message) and messages (conversation history)
 */
export interface StreamConfig {
  model: LanguageModel;
  system: string;
  prompt?: string;
  messages?: Array<ModelMessage>;
  maxOutputTokens?: number;
  temperature?: number;
  experimental_transform?: ReturnType<typeof smoothStream>;
  providerOptions?: ProviderOptions;
  // Tools from AI SDK - use unknown since CoreTool is not exported
  tools?: Record<string, unknown>;
}

/**
 * Document metadata type
 *
 * sourceContent: Pre-loaded text content from all source documents (loaded by tool)
 * instruction: Single instruction field for document generation
 * sourceDocumentIds: Kept for audit/metadata purposes only (handlers should use sourceContent)
 */
type DocumentMetadata = {
  documentType?: string;
  sourceContent?: string; // NEW: Pre-loaded source content
  instruction?: string; // NEW: Single instruction field
  sourceDocumentIds?: string[]; // Keep for audit/metadata
  primarySourceDocumentId?: string;
  meetingDate?: string;
  participants?: string[];
  [key: string]: unknown;
};

/**
 * Process a stream of text from the AI model and write deltas to the data stream
 * Returns the complete accumulated content
 *
 * Automatically handles thinking tags from Anthropic models:
 * - Thinking content is streamed as 'data-reasoning' events
 * - Final content has thinking tags removed
 * - Regular content is streamed as 'data-textDelta' events
 */
export async function processStream(
  config: StreamConfig,
  dataStream: UIMessageStreamWriter<ChatMessage>,
): Promise<string> {
  // Create processor to handle thinking detection and filtering
  const processor = new ThinkingStreamProcessor();

  // Cast tools to satisfy streamText type requirements
  const { fullStream } = streamText(config as Parameters<typeof streamText>[0]);

  for await (const delta of fullStream) {
    const { type } = delta;

    if (type === 'text-delta') {
      const { text } = delta;
      // Let processor handle all thinking detection and streaming
      processor.processTextDelta(text, dataStream);
    }
  }

  // Return content with thinking tags filtered out
  return processor.getFinalContent();
}

/**
 * Save generated document content to the database
 * Updates existing version content (one chat = one version pattern)
 */
export async function saveGeneratedDocument(
  versionId: string,
  content: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  const { updateVersionContent } = await import('@/lib/db/objective-document');
  await updateVersionContent(versionId, content, metadata);
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

  // Fetch all source documents in parallel (try both types)
  const sourceDocuments = await Promise.all(
    docIdsToFetch.map(async (docId) => {
      // Try KnowledgeDocument first
      const knowledgeDoc = await getKnowledgeDocumentById(docId);
      if (knowledgeDoc) {
        return {
          id: knowledgeDoc.id,
          title: knowledgeDoc.title,
          content: knowledgeDoc.content,
        };
      }

      // Try ObjectiveDocument
      const objectiveDoc = await getObjectiveDocumentById(docId);
      if (objectiveDoc?.latestVersion) {
        return {
          id: objectiveDoc.document.id,
          title: objectiveDoc.document.title,
          content: objectiveDoc.latestVersion.content,
        };
      }

      return null;
    }),
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
 * Prepends full prompt stack: CORE_SYSTEM_PROMPT + getCurrentContext + STREAMING_AGENT_PROMPT + specific system
 *
 * When chatId is provided, fetches conversation history and uses messages array instead of single prompt
 */
export async function buildStreamConfig({
  model,
  system,
  prompt,
  maxOutputTokens,
  thinkingBudget,
  temperature = 0.6,
  prediction,
  tools,
  chatId,
}: {
  model: LanguageModel;
  system: string;
  prompt: string;
  maxOutputTokens?: number;
  thinkingBudget?: number;
  temperature?: number;
  prediction?: string;
  // Tools from AI SDK - use unknown since CoreTool is not exported
  tools?: Record<string, unknown>;
  chatId?: string;
}): Promise<StreamConfig> {
  // Append no-preamble instruction to all prompts
  const promptWithInstructions = `${prompt}\n\nIMPORTANT: Generate ONLY the document content. Do NOT add preamble, summary, or explanatory text about what you will do. Start directly with the document.`;

  // Build full system prompt with standard layers for streamText
  const systemWithContext = `${CORE_SYSTEM_PROMPT}

${getCurrentContext({ user: null })}

${getStreamingAgentPrompt()}

${system}`;

  // Fetch chat history if chatId provided
  let messages: ModelMessage[] | undefined;
  if (chatId) {
    try {
      const messagesFromDb = await getMessagesByChatId({ id: chatId });
      const uiMessages = convertToUIMessages(messagesFromDb);

      // Convert to model format and append current user prompt
      const historicalMessages = convertToModelMessages(uiMessages);
      messages = [
        ...historicalMessages,
        { role: 'user' as const, content: promptWithInstructions },
      ];

      logger.debug('Fetched chat history for artifact generation', {
        chatId,
        messageCount: messagesFromDb.length,
        totalMessages: messages.length,
      });
    } catch (error) {
      // Fallback to single message if fetch fails
      logger.error('Failed to fetch chat history, using single prompt', {
        chatId,
        error,
      });
      messages = [{ role: 'user' as const, content: promptWithInstructions }];
    }
  }

  const config: StreamConfig = {
    model,
    system: systemWithContext,
    ...(messages ? { messages } : { prompt: promptWithInstructions }),
    maxOutputTokens,
    temperature,
    experimental_transform: smoothStream({ chunking: 'word' }),
    ...(tools && { tools }),
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

/**
 * Fetch and format knowledge documents with full attribution
 * Returns formatted text with titles and dates for LLM context
 */
export async function fetchKnowledgeDocuments(
  knowledgeDocIds: string[],
): Promise<string> {
  if (!knowledgeDocIds.length) {
    return '';
  }

  // Fetch all knowledge documents
  const docs = await Promise.all(
    knowledgeDocIds.map((id) => getKnowledgeDocumentById(id)),
  );

  // Filter out null/undefined and format with attribution
  const validDocs = docs.filter(
    (doc): doc is NonNullable<typeof doc> => doc !== null,
  );

  if (validDocs.length === 0) {
    return '';
  }

  // Format with full attribution including dates
  return validDocs
    .map((doc) => {
      const date = doc.sourceDate
        ? new Date(doc.sourceDate).toISOString().split('T')[0]
        : 'Unknown date';
      return `## ${doc.title} (${date})\n\n${doc.content}`;
    })
    .join('\n\n---\n\n');
}
