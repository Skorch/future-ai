import { myProvider } from '@/lib/ai/providers';
import { metadata } from './metadata';
import { MEETING_SUMMARY_GENERATION_PROMPT } from '@/lib/ai/prompts/domains/meeting-summary-generation';
import { OutputSize } from '@/lib/artifacts/types';
import {
  processStream,
  saveGeneratedDocument,
  fetchSourceDocuments,
  buildStreamConfig,
} from '../base-handler';
import type {
  DocumentHandler,
  CreateDocumentCallbackProps,
  UpdateDocumentCallbackProps,
} from '@/lib/artifacts/server';

// Type definitions for meeting summary metadata
interface MeetingSummaryMetadata {
  transcript?: string;
  sourceDocumentIds?: string[];
  meetingDate?: string;
  participants?: string[];
}

export const meetingSummaryHandler: DocumentHandler<'text'> = {
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
    const typedMetadata = docMetadata as MeetingSummaryMetadata | undefined;

    // Fetch source documents (required for meeting-memory)
    if (!typedMetadata?.sourceDocumentIds?.length) {
      throw new Error(
        'Meeting summaries require sourceDocumentIds to fetch transcript content',
      );
    }

    const transcript = await fetchSourceDocuments(
      typedMetadata.sourceDocumentIds,
      workspaceId,
    );

    if (!transcript) {
      throw new Error('No valid source documents found');
    }

    const meetingDate =
      typedMetadata?.meetingDate || new Date().toISOString().split('T')[0];
    const participants = typedMetadata?.participants || [];

    // Compose: Meeting summary generation prompt + specific instructions + template
    const systemPrompt = [
      MEETING_SUMMARY_GENERATION_PROMPT,
      '\n## Document Type Specific Instructions\n',
      metadata.prompt,
      '\n## Required Output Format\n',
      metadata.template,
    ]
      .filter(Boolean)
      .join('\n');

    // Build configuration with thinking budget support
    const streamConfig = buildStreamConfig({
      model: myProvider.languageModel('artifact-model'),
      system: systemPrompt,
      prompt: `Create a concise meeting summary from this transcript:

Meeting Date: ${meetingDate}
Participants: ${participants.join(', ')}

Transcript:
${transcript}`,
      maxOutputTokens: metadata.outputSize ?? OutputSize.SMALL,
      thinkingBudget: metadata.thinkingBudget,
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
        ...docMetadata,
        documentType: 'meeting-memory',
        sourceDocumentIds: typedMetadata?.sourceDocumentIds || [],
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
    // Build configuration for update with thinking budget support
    const streamConfig = buildStreamConfig({
      model: myProvider.languageModel('artifact-model'),
      system: `You are editing a meeting summary. Maintain concise, graduated detail (major topics 2-3 paragraphs, medium 2, minor 1). Current content:\n${document.content}`,
      prompt: description,
      maxOutputTokens: metadata.outputSize ?? OutputSize.LARGE,
      thinkingBudget: metadata.thinkingBudget,
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
