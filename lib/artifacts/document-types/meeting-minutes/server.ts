import { myProvider } from '@/lib/ai/providers';
import { metadata } from './metadata';
import { MEETING_MINUTES_PROMPT, MEETING_MINUTES_TEMPLATE } from './prompts';
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

interface MeetingMinutesMetadata {
  sourceDocumentIds?: string[];
  meetingDate?: string;
  participants?: string[];
  emailRecipients?: string[];
}

export const meetingMinutesHandler: DocumentHandler<'text'> = {
  kind: 'text',
  metadata,
  onCreateDocument: async ({
    id,
    title,
    dataStream,
    metadata: docMetadata,
    workspaceId,
    session,
    objectiveId,
  }: CreateDocumentCallbackProps) => {
    // Cast metadata to our expected type
    const typedMetadata = docMetadata as MeetingMinutesMetadata | undefined;

    // Fetch source documents (required for meeting minutes)
    if (!typedMetadata?.sourceDocumentIds?.length) {
      throw new Error(
        'Meeting minutes require sourceDocumentIds to fetch transcript content',
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
    const emailRecipients = typedMetadata?.emailRecipients || [];

    // Compose prompt with instructions and template
    const systemPrompt = composeSystemPrompt(
      MEETING_MINUTES_PROMPT,
      MEETING_MINUTES_TEMPLATE,
      'Required Output Format',
    );

    // Build user prompt
    const userPrompt = `Create brief, email-ready meeting minutes from this transcript:

Meeting: ${title}
Date: ${meetingDate}
Participants: ${participants.join(', ') || 'See transcript'}
${emailRecipients.length > 0 ? `Email Recipients: ${emailRecipients.join(', ')}` : ''}

Transcript:
${transcript}`;

    // Build configuration with thinking budget
    const streamConfig = buildStreamConfig({
      model: myProvider.languageModel('artifact-model'),
      system: systemPrompt,
      prompt: userPrompt,
      maxOutputTokens: metadata.outputSize ?? OutputSize.SMALL,
      thinkingBudget: metadata.thinkingBudget,
    });

    // Process the stream and collect content
    const content = await processStream(streamConfig, dataStream);

    // Save the generated document
    const result = await saveGeneratedDocument(content, {
      id,
      title,
      kind: 'text',
      session,
      workspaceId,
      objectiveId,
      metadata: {
        ...docMetadata,
        documentType: 'meeting-minutes',
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
      system: `You are editing email-ready meeting minutes. Keep them brief and action-focused. Current content:\n${documentContent}`,
      prompt: description,
      maxOutputTokens: metadata.outputSize ?? OutputSize.SMALL,
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
