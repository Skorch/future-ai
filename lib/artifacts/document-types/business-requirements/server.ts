import { myProvider } from '@/lib/ai/providers';
import { metadata } from './metadata';
import { BRD_PROMPT, BRD_TEMPLATE } from './prompts';
import { OutputSize } from '@/lib/artifacts/types';
import {
  processStream,
  saveGeneratedDocument,
  fetchSourceDocuments,
  buildStreamConfig,
  composeSystemPrompt,
} from '../base-handler';
import type {
  DocumentHandler,
  CreateDocumentCallbackProps,
  UpdateDocumentCallbackProps,
} from '@/lib/artifacts/server';

interface BRDMetadata {
  sourceDocumentIds?: string[];
  projectName?: string;
  clientName?: string;
  version?: string;
}

export const businessRequirementsHandler: DocumentHandler<'text'> = {
  kind: 'text',
  metadata,
  onCreateDocument: async ({
    id,
    title,
    dataStream,
    metadata: docMetadata,
    workspaceId,
    session,
  }: CreateDocumentCallbackProps) => {
    // Cast metadata to our expected type
    const typedMetadata = docMetadata as BRDMetadata | undefined;

    // Fetch source documents (required for BRD)
    if (!typedMetadata?.sourceDocumentIds?.length) {
      throw new Error(
        'Business Requirements Documents require sourceDocumentIds to fetch meeting transcripts',
      );
    }

    const transcripts = await fetchSourceDocuments(
      typedMetadata.sourceDocumentIds,
      workspaceId,
    );

    if (!transcripts) {
      throw new Error('No valid source documents found');
    }

    // Extract metadata parameters
    const projectName = typedMetadata?.projectName || title;
    const clientName = typedMetadata?.clientName || 'Client';
    const version = typedMetadata?.version || '1.0';

    // Compose prompt with instructions and template
    const systemPrompt = composeSystemPrompt(
      BRD_PROMPT,
      BRD_TEMPLATE,
      'BRD Template Structure',
    );

    // Build user prompt
    const userPrompt = `Create a comprehensive Business Requirements Document from these meeting transcripts:

Project: ${projectName}
Client: ${clientName}
Version: ${version}
Date: ${new Date().toISOString().split('T')[0]}

Meeting Transcripts and Documentation:
${transcripts}`;

    // Build configuration with high thinking budget for complex synthesis
    const streamConfig = buildStreamConfig({
      model: myProvider.languageModel('artifact-model'),
      system: systemPrompt,
      prompt: userPrompt,
      maxOutputTokens: metadata.outputSize ?? OutputSize.LARGE,
      thinkingBudget: metadata.thinkingBudget, // HIGH - 12000 tokens
    });

    // Process the stream and collect content
    const content = await processStream(streamConfig, dataStream);

    // Save the generated document
    const result = await saveGeneratedDocument(content, {
      id,
      title: `BRD - ${projectName}`,
      kind: 'text',
      session,
      workspaceId,
      metadata: {
        ...docMetadata,
        documentType: 'business-requirements',
        sourceDocumentIds: typedMetadata?.sourceDocumentIds || [],
      },
    });

    return result ? { versionId: result.versionId } : undefined;
  },
  onUpdateDocument: async ({
    document,
    description,
    dataStream,
    session,
    workspaceId,
  }: UpdateDocumentCallbackProps) => {
    // PHASE 4 REFACTORING: Document handlers will be refactored to use version content
    // @ts-ignore - Document structure will be updated in Phase 4
    const documentContent = document.content || '';

    // Build configuration for updates
    const streamConfig = buildStreamConfig({
      model: myProvider.languageModel('artifact-model'),
      system: `You are editing a Business Requirements Document. Maintain formal structure and comprehensive detail. Current content:\n${documentContent}`,
      prompt: description,
      maxOutputTokens: metadata.outputSize ?? OutputSize.LARGE,
      thinkingBudget: metadata.thinkingBudget,
      prediction: documentContent || undefined,
    });

    // Process the stream and collect content
    const content = await processStream(streamConfig, dataStream);

    // Save the updated document
    await saveGeneratedDocument(content, {
      id: document.id,
      title: document.title,
      kind: 'text',
      session,
      workspaceId,
    });

    return;
  },
};
