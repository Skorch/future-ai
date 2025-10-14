import { myProvider } from '@/lib/ai/providers';
import { metadata } from './metadata';
import { USE_CASE_PROMPT, USE_CASE_TEMPLATE } from './prompts';
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

interface UseCaseMetadata {
  sourceDocumentIds?: string[];
  clientName?: string;
  documentTitle?: string;
  fathomUrl?: string;
  workshopDate?: string;
}

export const useCaseHandler: DocumentHandler<'text'> = {
  kind: 'text',
  metadata,
  onCreateDocument: async ({
    id,
    versionId,
    title,
    dataStream,
    metadata: docMetadata,
    workspaceId,
    session,
    objectiveId,
  }: CreateDocumentCallbackProps) => {
    // Cast metadata to our expected type
    const typedMetadata = docMetadata as UseCaseMetadata | undefined;

    // Fetch source documents (required for use case)
    if (!typedMetadata?.sourceDocumentIds?.length) {
      throw new Error(
        'Business use cases require sourceDocumentIds to fetch workshop transcript',
      );
    }

    const transcript = await fetchSourceDocuments(
      typedMetadata.sourceDocumentIds,
      workspaceId,
    );

    if (!transcript) {
      throw new Error('No valid source documents found');
    }

    // Extract metadata parameters
    const clientName = typedMetadata?.clientName || 'Client';
    const documentTitle = typedMetadata?.documentTitle || title;
    const fathomUrl = typedMetadata?.fathomUrl || '';
    const workshopDate =
      typedMetadata?.workshopDate || new Date().toISOString().split('T')[0];

    // Compose prompt with instructions and template
    const systemPrompt = composeSystemPrompt(
      USE_CASE_PROMPT,
      USE_CASE_TEMPLATE,
      'Document Template',
    );

    // Build user prompt
    const userPrompt = `Generate a business use case document from this workshop transcript:

Client Name: ${clientName}
Document Title: ${documentTitle}
Workshop Date: ${workshopDate}
${fathomUrl ? `Fathom Recording URL: ${fathomUrl}` : 'No Fathom URL provided - skip timestamps'}

Workshop Transcript:
${transcript}`;

    // Build configuration with thinking budget for analysis
    const streamConfig = buildStreamConfig({
      model: myProvider.languageModel('artifact-model'),
      system: systemPrompt,
      prompt: userPrompt,
      maxOutputTokens: metadata.outputSize ?? OutputSize.MEDIUM,
      thinkingBudget: metadata.thinkingBudget,
    });

    // Process the stream and collect content
    const content = await processStream(streamConfig, dataStream);

    // Save the generated document
    const result = await saveGeneratedDocument(content, {
      id,
      versionId,
      title: documentTitle,
      kind: 'text',
      session,
      workspaceId,
      objectiveId,
      metadata: {
        ...docMetadata,
        documentType: 'use-case',
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
      system: `You are editing a business use case document. Maintain the structure and completeness. Current content:\n${documentContent}`,
      prompt: description,
      maxOutputTokens: metadata.outputSize ?? OutputSize.MEDIUM,
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
      objectiveId: undefined,
    });

    return;
  },
};
