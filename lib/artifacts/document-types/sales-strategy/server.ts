import type {
  DocumentHandler,
  GeneratePunchlistCallbackProps,
} from '@/lib/artifacts/server';
import { metadata } from './metadata';
import {
  SALES_STRATEGY_PROMPT,
  SALES_STRATEGY_TEMPLATE,
  SALES_STRATEGY_PUNCHLIST_PROMPT,
} from './prompts';
import {
  fetchSourceDocuments,
  buildStreamConfig,
  processStream,
  saveGeneratedDocument,
  generatePunchlist,
  fetchKnowledgeDocuments,
  GLOBAL_PUNCHLIST_TEMPLATE,
} from '@/lib/artifacts/document-types/base-handler';
import { OutputSize } from '@/lib/artifacts/types';
import { updateDocumentPrompt } from '@/lib/ai/prompts';
import { myProvider } from '@/lib/ai/providers';

export const salesStrategyHandler: DocumentHandler<'text'> = {
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
      versionId,
      title,
      kind: 'text',
      session,
      workspaceId,
      objectiveId,
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
      temperature: metadata.temperature,
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
  onGeneratePunchlist: async ({
    currentVersion,
    knowledgeDocIds,
    instruction,
    dataStream,
    workspaceId,
    session,
  }: GeneratePunchlistCallbackProps) => {
    // Fetch knowledge documents with full attribution
    const knowledgeSummaries = await fetchKnowledgeDocuments(knowledgeDocIds);

    if (!knowledgeSummaries) {
      throw new Error(
        'No valid knowledge documents found for punchlist generation',
      );
    }

    // Generate punchlist with Sales Strategy-specific tracking goals
    const punchlistContent = await generatePunchlist({
      currentPunchlist: currentVersion.punchlist,
      currentContent: currentVersion.content,
      knowledgeSummaries,
      documentSpecificPrompt: SALES_STRATEGY_PUNCHLIST_PROMPT,
      globalPunchlistTemplate: GLOBAL_PUNCHLIST_TEMPLATE,
      dataStream,
    });

    // Save punchlist to database
    const { updateVersionPunchlist } = await import(
      '@/lib/db/objective-document'
    );
    await updateVersionPunchlist(currentVersion.id, punchlistContent);

    return punchlistContent;
  },
};
