import { myProvider } from '@/lib/ai/providers';
import { updateDocumentPrompt } from '@/lib/ai/prompts';
import { metadata } from './metadata';
import { MEETING_AGENDA_PROMPT, MEETING_AGENDA_TEMPLATE } from './prompts';
import { OutputSize } from '@/lib/artifacts/types';
import {
  processStream,
  saveGeneratedDocument,
  buildStreamConfig,
  composeSystemPrompt,
} from '../base-handler';
import type {
  DocumentHandler,
  CreateDocumentCallbackProps,
  UpdateDocumentCallbackProps,
} from '@/lib/artifacts/server';

export const meetingAgendaHandler: DocumentHandler<'text'> = {
  kind: 'text',
  metadata,
  onCreateDocument: async ({
    id,
    title,
    dataStream,
    metadata: docMetadata,
    session,
    workspaceId,
  }: CreateDocumentCallbackProps) => {
    // Compose prompt with instructions and template
    const systemPrompt = composeSystemPrompt(
      MEETING_AGENDA_PROMPT,
      MEETING_AGENDA_TEMPLATE,
    );

    // Extract optional parameters from metadata
    const meetingTitle = (docMetadata?.meetingTitle as string) || title;
    const duration = (docMetadata?.duration as string) || '60 minutes';
    const attendees = (docMetadata?.attendees as string[]) || [];
    const objectives = (docMetadata?.objectives as string[]) || [];

    // Build user prompt with available context
    const userPrompt = `Create a meeting agenda for: ${meetingTitle}
${duration ? `Duration: ${duration}` : ''}
${attendees.length > 0 ? `Attendees: ${attendees.join(', ')}` : ''}
${objectives.length > 0 ? `Objectives: ${objectives.join('; ')}` : ''}
${title !== meetingTitle ? `Additional context: ${title}` : ''}`;

    // Build configuration with thinking budget for structure planning
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
      title: meetingTitle,
      kind: 'text',
      session,
      workspaceId,
      metadata: {
        ...docMetadata,
        documentType: 'meeting-agenda',
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
    // Build configuration for updates
    const streamConfig = buildStreamConfig({
      model: myProvider.languageModel('artifact-model'),
      system: updateDocumentPrompt(document.content, 'text'),
      prompt: description,
      maxOutputTokens: metadata.outputSize ?? OutputSize.SMALL,
      thinkingBudget: metadata.thinkingBudget,
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
