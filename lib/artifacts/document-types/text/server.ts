import { myProvider } from '@/lib/ai/providers';
import { updateDocumentPrompt } from '@/lib/ai/prompts';
import { metadata as artifactMetadata } from './metadata';
import { OutputSize } from '@/lib/artifacts/types';
import {
  processStream,
  saveGeneratedDocument,
  buildStreamConfig,
} from '../base-handler';
import type {
  DocumentHandler,
  CreateDocumentCallbackProps,
  UpdateDocumentCallbackProps,
} from '@/lib/artifacts/server';

export const textDocumentHandler: DocumentHandler<'text'> = {
  kind: 'text',
  onCreateDocument: async ({
    id,
    title,
    dataStream,
    metadata,
    session,
    workspaceId,
  }: CreateDocumentCallbackProps) => {
    // Build configuration for this document type
    const streamConfig = buildStreamConfig({
      model: myProvider.languageModel('artifact-model'),
      system:
        'Write about the given topic. Markdown is supported. Use headings wherever appropriate.',
      prompt: title,
      maxOutputTokens: artifactMetadata.outputSize ?? OutputSize.LARGE,
    });

    // Process the stream and collect content
    const content = await processStream(streamConfig, dataStream);

    // Save the generated document
    await saveGeneratedDocument(content, {
      id,
      title,
      kind: 'text',
      session,
      workspaceId,
      metadata: {
        ...(metadata || {}),
        documentType: (metadata?.documentType as string | undefined) || 'text',
      },
    });

    return;
  },
  onUpdateDocument: async ({
    document,
    description,
    dataStream,
    session,
    workspaceId,
  }: UpdateDocumentCallbackProps) => {
    // Build configuration with prediction for updates
    const streamConfig = buildStreamConfig({
      model: myProvider.languageModel('artifact-model'),
      system: updateDocumentPrompt(document.content, 'text'),
      prompt: description,
      maxOutputTokens: artifactMetadata.outputSize ?? OutputSize.LARGE,
      prediction: document.content || undefined,
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
