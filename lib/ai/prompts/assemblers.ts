/**
 * Prompt Assembly Module
 *
 * This module centralizes the logic for assembling prompts for both:
 * 1. Main chat agent (domain + mode + context)
 * 2. Document generation agents (per document type)
 *
 * This makes prompts easier to preview, debug, and test.
 */

import type { ChatMode, ModeContext } from '@/lib/db/schema';
import type { DomainId } from '@/lib/domains';
import { DOMAINS } from '@/lib/domains';
import { getModeConfig } from '@/lib/ai/modes';
import { composeSystemPrompt, getSystemPromptHeader } from './system';
import type { DocumentType } from '@/lib/artifacts';
import { getDocumentTypeDefinition } from '@/lib/artifacts';
import * as tools from '@/lib/ai/tools';

/**
 * Assembled sections of the main agent system prompt
 */
export interface MainAgentPromptSections {
  base: string;
  capabilities: string;
  domain: string;
  mode: string;
  completion: string | null;
}

/**
 * StreamText configuration for the main agent
 */
export interface MainAgentStreamConfig {
  model: string;
  temperature?: number;
  thinkingBudget?: number;
  maxOutputTokens?: number;
  activeTools: string[];
}

/**
 * Tool description for display
 */
export interface ToolDescription {
  name: string;
  description: string;
  isActive: boolean;
}

/**
 * Result of assembling the main agent prompt
 */
export interface MainAgentPromptResult {
  systemPrompt: string;
  sections: MainAgentPromptSections;
  streamConfig: MainAgentStreamConfig;
  toolDescriptions: ToolDescription[]; // All tool descriptions
}

/**
 * Assemble the main chat agent prompt with all its components
 */
export async function assembleMainAgentPrompt(params: {
  domainId: DomainId;
  mode: ChatMode;
  modeContext: ModeContext;
  isComplete: boolean;
}): Promise<MainAgentPromptResult> {
  const { domainId, mode, modeContext, isComplete } = params;

  // Get domain configuration
  const domain = DOMAINS[domainId];

  // Get mode configuration
  const modeConfig = getModeConfig(mode);

  // Compose base + capabilities + domain prompt
  const baseAndDomain = await composeSystemPrompt({
    domainPrompts: [domain.prompt],
    domainId,
  });

  // Extract sections by splitting on the separator
  const parts = baseAndDomain.split('\n\n---\n\n');
  const [base = '', capabilities = '', domainPrompt = ''] = parts;

  // Generate mode-specific system prompt
  const modePrompt = modeConfig.system(modeContext);

  // Add completion status if task is complete
  const completionStatus = isComplete
    ? '\n\n📋 STATUS: This task/conversation has been marked as COMPLETE. The user believes all requirements have been met. You should:\n- Acknowledge the completion if asked\n- Be ready to help with new tasks\n- Avoid reopening completed work unless explicitly requested\n- Transition smoothly to any new topics or requests'
    : null;

  // Final system prompt (mode overrides base) with current date context
  const systemPrompt = `${getSystemPromptHeader()}\n\n${modePrompt}${completionStatus || ''}`;

  // Get all tool descriptions dynamically
  const activeToolNames = new Set(modeConfig.experimental_activeTools);
  const toolDescriptions: ToolDescription[] = [];

  // Create mock context for tools
  const mockSession = { user: { id: 'preview' } };
  // biome-ignore lint/suspicious/noExplicitAny: Mock data stream for preview purposes
  const mockDataStream = {} as any;
  const mockWorkspaceId = 'preview';

  // Gather tool descriptions by calling their factories
  for (const [toolName, toolFactory] of Object.entries(tools)) {
    try {
      // biome-ignore lint/suspicious/noImplicitAnyLet: Tool instance type varies by tool
      let toolInstance;

      // Call tool factory with required context based on tool type
      if (toolName === 'createDocument') {
        // biome-ignore lint/suspicious/noExplicitAny: Tool factories have different signatures
        toolInstance = await (toolFactory as any)({
          session: mockSession,
          dataStream: mockDataStream,
          workspaceId: mockWorkspaceId,
          domainId,
        });
      } else if (
        [
          'updateDocument',
          'queryRAG',
          'listDocuments',
          'loadDocument',
          'loadDocuments',
        ].includes(toolName)
      ) {
        // biome-ignore lint/suspicious/noExplicitAny: Tool factories have different signatures
        toolInstance = (toolFactory as any)({
          session: mockSession,
          dataStream: mockDataStream,
          workspaceId: mockWorkspaceId,
        });
      } else if (['setMode', 'askUser', 'setComplete'].includes(toolName)) {
        // biome-ignore lint/suspicious/noExplicitAny: Tool factories have different signatures
        toolInstance = (toolFactory as any)({
          dataStream: mockDataStream,
        });
      }

      if (toolInstance?.description) {
        toolDescriptions.push({
          name: toolName,
          description: toolInstance.description,
          isActive: activeToolNames.has(toolName),
        });
      }
    } catch (error) {
      // Skip tools that can't be instantiated for preview
    }
  }

  return {
    systemPrompt,
    sections: {
      base,
      capabilities,
      domain: domainPrompt,
      mode: modePrompt,
      completion: completionStatus,
    },
    streamConfig: {
      model: modeConfig.model,
      temperature: modeConfig.temperature,
      thinkingBudget: modeConfig.thinkingBudget,
      maxOutputTokens: modeConfig.maxOutputTokens,
      activeTools: modeConfig.experimental_activeTools,
    },
    toolDescriptions,
  };
}

/**
 * Assembled sections of the document generation prompt
 */
export interface DocGenPromptSections {
  expertSystem: string;
  outputTemplate: string;
  agentContext?: string;
  primaryDoc: string;
  referenceDocs?: string;
  metadata: string;
}

/**
 * StreamText configuration for document generation
 */
export interface DocGenStreamConfig {
  model: string;
  temperature?: number;
  maxOutputTokens?: number;
  thinkingBudget?: number;
  experimental_transform?: string; // Stringified for preview
  providerOptions?: Record<string, unknown>;
}

/**
 * Result of assembling a document generation prompt
 */
export interface DocGenPromptResult {
  systemPrompt: string;
  userPrompt: string;
  sections: DocGenPromptSections;
  streamConfig: DocGenStreamConfig;
}

/**
 * Assemble document generation prompt
 * Uses placeholder content for documents since this is for preview/debug
 */
export async function assembleDocumentPrompt(params: {
  documentType: DocumentType;
  agentInstruction?: string;
  metadata: Record<string, unknown>;
}): Promise<DocGenPromptResult> {
  const { documentType, agentInstruction, metadata: userMetadata } = params;

  // Get document type definition
  const definition = await getDocumentTypeDefinition(documentType);
  const { metadata: docMetadata } = definition;

  // Build system prompt based on document type structure
  let systemPrompt: string;
  let expertSystem: string;
  let outputTemplate: string;

  // Try to load prompts dynamically for document types that have them
  try {
    const promptsModule = await import(
      `@/lib/artifacts/document-types/${documentType}/prompts`
    );

    // Find the main prompt and template keys
    const promptKeys = Object.keys(promptsModule);
    const mainPromptKey = promptKeys.find((k) =>
      k.toUpperCase().includes('PROMPT'),
    );
    const templateKey = promptKeys.find((k) =>
      k.toUpperCase().includes('TEMPLATE'),
    );

    expertSystem = mainPromptKey ? promptsModule[mainPromptKey] : '';
    outputTemplate = templateKey ? promptsModule[templateKey] : '';

    // Compose system prompt
    const parts = [expertSystem];
    if (outputTemplate) {
      parts.push('\n## Required Output Format\n', outputTemplate);
    }
    systemPrompt = parts.join('\n');
  } catch {
    // Fallback for simple document types (text, etc.) that don't have a prompts file
    expertSystem = docMetadata.prompt || 'Write a professional document.';
    outputTemplate = docMetadata.template || '';
    systemPrompt = expertSystem;
  }

  // Build user prompt sections
  const agentContext = agentInstruction
    ? `## Agent Context\n${agentInstruction}\n\n`
    : undefined;

  // Placeholder for primary document
  const primaryDoc =
    documentType === 'sales-call-summary'
      ? '## Sales Call Transcript (Analyze This)\n[CONTENT FROM PRIMARY DOC]\n\n'
      : documentType === 'meeting-analysis' ||
          documentType === 'meeting-minutes'
        ? '## Transcript to Analyze\n[CONTENT FROM PRIMARY DOC]\n\n'
        : '';

  // Placeholder for reference documents
  const referenceDocs =
    documentType === 'sales-call-summary'
      ? '## Reference Documents (Previous Call Analyses)\n[CONTENT FROM REF DOC]\n\n**Citation Requirement:** When referencing information from these previous analyses, cite them using the format [Doc: "Document Title"].\n\n**Usage Guidance:** Leverage these reference documents to build the deal narrative timeline, track BANT progression, and identify momentum patterns.\n\n'
      : documentType === 'meeting-analysis'
        ? '## Reference Documents (Historical Meeting Analyses)\n[CONTENT FROM REF DOC]\n\n**Citation Requirement:** When referencing information from these historical documents, cite them using the format [Doc: "Document Title"].\n\n'
        : undefined;

  // Build metadata section
  let metadataSection = '';
  if (documentType === 'sales-call-summary') {
    metadataSection = `## Call Metadata
- **Call Date:** ${userMetadata.callDate || 'Not specified'}
- **Participants:** ${userMetadata.participants ? (userMetadata.participants as string[]).join(', ') : 'Not specified'}
- **Deal/Prospect:** ${userMetadata.dealName || 'Not specified'} - ${userMetadata.prospectCompany || 'Not specified'}`;
  } else if (
    documentType === 'meeting-analysis' ||
    documentType === 'meeting-minutes'
  ) {
    metadataSection = `## Meeting Metadata
- **Meeting Date:** ${userMetadata.meetingDate || new Date().toISOString().split('T')[0]}
- **Participants:** ${userMetadata.participants ? (userMetadata.participants as string[]).join(', ') : 'Not specified'}`;
  }

  // Compose user prompt
  const userPromptParts = [
    agentContext,
    primaryDoc,
    referenceDocs,
    metadataSection,
  ].filter(Boolean);

  const userPrompt = userPromptParts.join('');

  // Build stream config
  const streamConfig: DocGenStreamConfig = {
    model: 'claude-sonnet-4', // artifact-model
    temperature: docMetadata.temperature || 0.6,
    maxOutputTokens: docMetadata.outputSize || 16000,
    thinkingBudget: docMetadata.thinkingBudget,
    experimental_transform: 'smoothStream({ chunking: "word" })',
    providerOptions: {
      anthropic: {
        cacheControl: true,
      },
    },
  };

  return {
    systemPrompt,
    userPrompt,
    sections: {
      expertSystem,
      outputTemplate,
      agentContext,
      primaryDoc,
      referenceDocs,
      metadata: metadataSection,
    },
    streamConfig,
  };
}
