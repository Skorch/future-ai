/**
 * Base utilities for document handlers
 * These functions extract the common patterns across all document types
 * while allowing each handler to maintain its own prompts and configuration
 */

import { streamText, smoothStream } from 'ai';
import { getKnowledgeDocumentById } from '@/lib/db/knowledge-document';
import { getObjectiveDocumentById } from '@/lib/db/objective-document';
import type { LanguageModel, UIMessageStreamWriter } from 'ai';
import type { ChatMessage } from '@/lib/types';
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

/**
 * Global punchlist template for consistent formatting
 * Defines the standard structure for all punchlist types
 */
export const GLOBAL_PUNCHLIST_TEMPLATE = `
## Punchlist Format Rules

Your punchlist must follow this exact structure:

# Punchlist - Version [auto-increment based on current version]

## 🚨 Risks (count)
- [R1] Risk description → STATUS (Knowledge: "Document Title (YYYY-MM-DD)")
- [R2] Another risk

## ❓ Unknowns (count)
- [U1] Unknown description → STATUS (Knowledge: "Document Title (YYYY-MM-DD)")

## 🚧 Blockers (count)
- [B1] Blocker description → STATUS (Knowledge: "Document Title (YYYY-MM-DD)")

## ⚡ Gaps (count)
- [G1] Gap description → STATUS (Knowledge: "Document Title (YYYY-MM-DD)")

## ⚠️ Contradictions (count)
- [C1] Contradiction description → STATUS (Knowledge: "Document Title (YYYY-MM-DD)")

---

## Changes from Knowledge
Brief summary of what changed in this update

## Item Status Codes
- **RESOLVED ✓**: Knowledge fully addresses this item
- **MODIFIED**: Knowledge partially addresses or updates this item
- **NEW**: New item discovered from this knowledge
- No status: Item unchanged from previous version

## Attribution Format
Always attribute changes to specific knowledge with full title and date:
- Good: (Knowledge: "Sales Call Summary - Mozilla Meeting (2024-12-15)")
- Good: (Knowledge: "Requirements Meeting - Tech Review (2024-12-16)")
- Bad: (Knowledge #3)
- Bad: (Meeting notes)
`;

/**
 * Properties for generating punchlist content
 */
export interface GeneratePunchlistProps {
  currentPunchlist: string | null;
  currentContent: string;
  knowledgeSummaries: string;
  documentSpecificPrompt: string;
  globalPunchlistTemplate: string;
  dataStream: UIMessageStreamWriter<ChatMessage>;
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

/**
 * Generate punchlist content from document state and new knowledge
 * Combines document-specific tracking goals with global formatting rules
 */
export async function generatePunchlist({
  currentPunchlist,
  currentContent,
  knowledgeSummaries,
  documentSpecificPrompt,
  globalPunchlistTemplate,
  dataStream,
}: GeneratePunchlistProps): Promise<string> {
  // Build comprehensive system prompt
  const systemPrompt = `${documentSpecificPrompt}

${globalPunchlistTemplate}

## Current Context

### Current Document Content
${currentContent}

### Current Punchlist
${currentPunchlist || 'No punchlist yet - this is the first knowledge input. Generate an initial punchlist based on the current document content and new knowledge.'}

### New Knowledge to Process
${knowledgeSummaries}

## Your Task
Analyze the new knowledge and update the punchlist to show:
1. Which items are now RESOLVED (knowledge fully addresses them)
2. Which items are MODIFIED (knowledge partially addresses or updates them)
3. NEW items discovered from the knowledge
4. Items that remain unchanged

Always use the full knowledge document title and date for attribution.
At the end, summarize what changed in the "Changes from Knowledge" section.`;

  // Build configuration for punchlist generation
  const config = buildStreamConfig({
    model: (await import('@/lib/ai/providers')).myProvider.languageModel(
      'claude-sonnet-4',
    ),
    system: systemPrompt,
    prompt:
      'Generate the updated punchlist showing how the new knowledge affects each item.',
    maxOutputTokens: 4000, // Punchlists can be comprehensive
    temperature: 0.4, // Lower for consistency
  });

  // Stream the punchlist generation
  const content = await processStream(config, dataStream);

  return content;
}
