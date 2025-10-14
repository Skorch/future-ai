import type { DocumentHandler } from '@/lib/artifacts/server';
import { metadata } from './metadata';
import {
  SALES_CALL_SUMMARY_PROMPT,
  SALES_CALL_SUMMARY_TEMPLATE,
} from './prompts';
import {
  fetchSourceDocuments,
  buildStreamConfig,
  processStream,
  saveGeneratedDocument,
} from '@/lib/artifacts/document-types/base-handler';
import { OutputSize } from '@/lib/artifacts/types';
import { updateDocumentPrompt } from '@/lib/ai/prompts';
import { myProvider } from '@/lib/ai/providers';

export const salesCallSummaryHandler: DocumentHandler<'text'> = {
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
  }) => {
    const typedMetadata = docMetadata as {
      sourceDocumentIds?: string[];
      primarySourceDocumentId?: string;
      agentInstruction?: string;
      callDate?: string;
      participants?: string[];
      dealName?: string;
      prospectCompany?: string;
    };

    // Extract parameters
    const primaryDocId = typedMetadata?.primarySourceDocumentId;
    const agentInstruction = typedMetadata?.agentInstruction || '';
    const callDate = typedMetadata?.callDate || 'Not specified';
    const participants =
      typedMetadata?.participants?.join(', ') || 'Not specified';
    const dealName = typedMetadata?.dealName || 'Not specified';
    const prospectCompany = typedMetadata?.prospectCompany || 'Not specified';

    // Fetch documents with primary/supporting distinction
    let promptContent: string;

    if (primaryDocId) {
      const { primaryDocument, supportingDocuments } =
        await fetchSourceDocuments(
          typedMetadata.sourceDocumentIds,
          workspaceId,
          primaryDocId,
        );

      promptContent = `Create a comprehensive sales call summary from this transcript:

${agentInstruction ? `## Agent Context\n${agentInstruction}\n\n` : ''}

## Sales Call Transcript (Analyze This)
${primaryDocument}

${
  supportingDocuments
    ? `## Reference Documents (Previous Call Analyses)
${supportingDocuments}

**Citation Requirement:** When referencing information from these previous analyses, cite them using the format [Doc: "Document Title"].

**Usage Guidance:** Leverage these reference documents to build the deal narrative timeline, track BANT progression, and identify momentum patterns. Compare current call to previous interactions. Only include historical references where they add meaningful context.
`
    : ''
}

## Call Metadata
- **Call Date:** ${callDate}
- **Participants:** ${participants}
- **Deal/Prospect:** ${dealName} - ${prospectCompany}`;
    } else {
      // Fallback: treat all as transcript (backward compatible)
      const transcript = await fetchSourceDocuments(
        typedMetadata.sourceDocumentIds,
        workspaceId,
      );

      promptContent = `Create a comprehensive sales call summary from this transcript:

${agentInstruction ? `## Agent Context\n${agentInstruction}\n\n` : ''}

${transcript}

## Call Metadata
- **Call Date:** ${callDate}
- **Participants:** ${participants}
- **Deal/Prospect:** ${dealName} - ${prospectCompany}`;
    }

    // Compose system prompt directly - no redundant middle layer
    const systemPrompt = [
      SALES_CALL_SUMMARY_PROMPT,
      '\n## Required Output Format\n',
      SALES_CALL_SUMMARY_TEMPLATE,
    ].join('\n');

    // Build stream configuration
    const streamConfig = buildStreamConfig({
      model: myProvider.languageModel('artifact-model'),
      system: systemPrompt,
      prompt: promptContent,
      maxOutputTokens: metadata.outputSize ?? OutputSize.MEDIUM,
      thinkingBudget: metadata.thinkingBudget,
    });

    // Process stream and save
    const content = await processStream(streamConfig, dataStream);

    const result = await saveGeneratedDocument(content, {
      id,
      versionId,
      title,
      kind: 'text',
      session,
      workspaceId,
      objectiveId,
      metadata: {
        ...docMetadata,
        documentType: 'sales-call-summary',
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
  }) => {
    // PHASE 4 REFACTORING: Document handlers will be refactored to use version content
    // @ts-ignore - Document structure will be updated in Phase 4
    const documentContent = document.content || '';

    // Standard update using prediction feature
    const streamConfig = buildStreamConfig({
      model: myProvider.languageModel('artifact-model'),
      system: updateDocumentPrompt(documentContent, 'text'),
      prompt: description,
      maxOutputTokens: metadata.outputSize ?? OutputSize.MEDIUM,
      thinkingBudget: metadata.thinkingBudget,
      prediction: documentContent || undefined,
    });

    const content = await processStream(streamConfig, dataStream);

    await saveGeneratedDocument(content, {
      id: document.id,
      title: document.title,
      kind: 'text',
      session,
      workspaceId,
      objectiveId: undefined,
    });
  },
};
