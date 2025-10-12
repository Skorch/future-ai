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
  primarySourceDocumentId?: string;
  agentInstruction?: string;
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
    objectiveId,
  }: CreateDocumentCallbackProps) => {
    // Cast metadata to our expected type
    const typedMetadata = docMetadata as MeetingSummaryMetadata | undefined;

    // Fetch source documents (required for meeting-analysis)
    if (!typedMetadata?.sourceDocumentIds?.length) {
      throw new Error(
        'Meeting summaries require sourceDocumentIds to fetch transcript content',
      );
    }

    // Extract parameters
    const primaryDocId = typedMetadata?.primarySourceDocumentId;
    const agentInstruction = typedMetadata?.agentInstruction || '';
    const meetingDate =
      typedMetadata?.meetingDate || new Date().toISOString().split('T')[0];
    const participants = typedMetadata?.participants || [];

    // Fetch documents with primary/supporting distinction if specified
    let promptContent: string;

    if (primaryDocId) {
      const { primaryDocument, supportingDocuments } =
        await fetchSourceDocuments(
          typedMetadata.sourceDocumentIds,
          workspaceId,
          primaryDocId,
        );

      if (!primaryDocument) {
        throw new Error('Primary source document not found');
      }

      promptContent = `Create a concise meeting summary from this transcript:

${agentInstruction ? `## Agent Context\n${agentInstruction}\n\n` : ''}

## Transcript to Analyze
${primaryDocument}

${
  supportingDocuments
    ? `## Reference Documents (Historical Meeting Analyses)
${supportingDocuments}

**Citation Requirement:** When referencing information from these historical documents, cite them using the format [Doc: "Document Title"]. Example: "In the previous meeting [Doc: "Q3 Planning Session"], we decided to prioritize feature X."

**Usage Guidance:** Leverage these reference documents to provide historical context, track decision progression, and identify patterns across meetings. Only include historical references where they add meaningful context to the current analysis.
`
    : ''
}

Meeting Date: ${meetingDate}
Participants: ${participants.join(', ')}`;
    } else {
      // Backward compatible: treat all as transcript
      const transcript = await fetchSourceDocuments(
        typedMetadata.sourceDocumentIds,
        workspaceId,
      );

      if (!transcript) {
        throw new Error('No valid source documents found');
      }

      promptContent = `Create a concise meeting summary from this transcript:

${agentInstruction ? `## Agent Context\n${agentInstruction}\n\n` : ''}

${transcript}

Meeting Date: ${meetingDate}
Participants: ${participants.join(', ')}`;
    }

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
      prompt: promptContent,
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
        documentType: 'meeting-analysis',
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

    // Build configuration for update with thinking budget support
    const streamConfig = buildStreamConfig({
      model: myProvider.languageModel('artifact-model'),
      system: `You are editing a meeting summary. Maintain concise, graduated detail (major topics 2-3 paragraphs, medium 2, minor 1). Current content:\n${documentContent}`,
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
      objectiveId: undefined,
    });

    return;
  },
};
