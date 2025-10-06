import type { DocumentHandler } from '@/lib/artifacts/server';
import { metadata } from './metadata';
import { SALES_STRATEGY_PROMPT, SALES_STRATEGY_TEMPLATE } from './prompts';
import {
  fetchSourceDocuments,
  buildStreamConfig,
  processStream,
  saveGeneratedDocument,
} from '@/lib/artifacts/document-types/base-handler';
import { OutputSize } from '@/lib/artifacts/types';
import { updateDocumentPrompt } from '@/lib/ai/prompts';
import { myProvider } from '@/lib/ai/providers';

export const salesStrategyHandler: DocumentHandler<'text'> = {
  kind: 'text',
  metadata,

  onCreateDocument: async ({
    id,
    title,
    dataStream,
    metadata: docMetadata,
    workspaceId,
    session,
  }) => {
    const typedMetadata = docMetadata as {
      sourceDocumentIds?: string[];
      primarySourceDocumentId?: string;
      agentInstruction?: string;
      dealName?: string;
      prospectCompany?: string;
      specificQuestion?: string;
    };

    // Extract parameters
    const primaryDocId = typedMetadata?.primarySourceDocumentId;
    const agentInstruction = typedMetadata?.agentInstruction || '';
    const dealName = typedMetadata?.dealName || 'Not specified';
    const prospectCompany = typedMetadata?.prospectCompany || 'Not specified';
    const specificQuestion = typedMetadata?.specificQuestion || '';

    // Fetch sales-analysis documents for strategic recommendations
    let promptContent: string;

    if (primaryDocId) {
      const { primaryDocument, supportingDocuments } =
        await fetchSourceDocuments(
          typedMetadata.sourceDocumentIds,
          workspaceId,
          primaryDocId,
        );

      promptContent = `Create strategic recommendations based on sales call analysis:

${agentInstruction ? `## Strategic Context\n${agentInstruction}\n\n` : ''}

${specificQuestion ? `## Specific Strategic Question\n${specificQuestion}\n\n` : ''}

## Primary Sales Analysis (Most Recent Call)
${primaryDocument}

${
  supportingDocuments
    ? `## Historical Sales Analyses (Previous Calls)
${supportingDocuments}

**Historical Context:** Use these previous analyses to assess deal progression, momentum shifts, and pattern recognition. Compare how BANT has evolved, relationship quality changes, and competitive landscape shifts.
`
    : ''
}

## Deal Context
- **Deal/Prospect:** ${dealName} - ${prospectCompany}

**Your Task:** Provide actionable strategic recommendations, probability assessment, risk analysis, and tactical next steps based on the evidence in these sales analyses.`;
    } else {
      // Fallback: treat all as analyses (backward compatible)
      const analyses = await fetchSourceDocuments(
        typedMetadata.sourceDocumentIds,
        workspaceId,
      );

      promptContent = `Create strategic recommendations based on sales call analysis:

${agentInstruction ? `## Strategic Context\n${agentInstruction}\n\n` : ''}

${specificQuestion ? `## Specific Strategic Question\n${specificQuestion}\n\n` : ''}

${analyses}

## Deal Context
- **Deal/Prospect:** ${dealName} - ${prospectCompany}

**Your Task:** Provide actionable strategic recommendations, probability assessment, risk analysis, and tactical next steps based on the evidence in these sales analyses.`;
    }

    // Compose system prompt
    const systemPrompt = [
      SALES_STRATEGY_PROMPT,
      '\n## Required Output Format\n',
      SALES_STRATEGY_TEMPLATE,
    ].join('\n');

    // Build stream configuration
    const streamConfig = buildStreamConfig({
      model: myProvider.languageModel('artifact-model'),
      system: systemPrompt,
      prompt: promptContent,
      maxOutputTokens: metadata.outputSize ?? OutputSize.MEDIUM,
      thinkingBudget: metadata.thinkingBudget,
      temperature: metadata.temperature,
    });

    // Process stream and save
    const content = await processStream(streamConfig, dataStream);

    const result = await saveGeneratedDocument(content, {
      id,
      title,
      kind: 'text',
      session,
      workspaceId,
      metadata: {
        ...docMetadata,
        documentType: 'sales-strategy',
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
    // Standard update using prediction feature
    const streamConfig = buildStreamConfig({
      model: myProvider.languageModel('artifact-model'),
      system: updateDocumentPrompt(document.content, 'text'),
      prompt: description,
      maxOutputTokens: metadata.outputSize ?? OutputSize.MEDIUM,
      thinkingBudget: metadata.thinkingBudget,
      temperature: metadata.temperature,
      prediction: document.content || undefined,
    });

    const content = await processStream(streamConfig, dataStream);

    await saveGeneratedDocument(content, {
      id: document.id,
      title: document.title,
      kind: 'text',
      session,
      workspaceId,
    });
  },
};
