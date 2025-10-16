import type {
  DocumentHandler,
  GeneratePunchlistCallbackProps,
} from '@/lib/artifacts/server';
import { metadata } from './metadata';
import { SALES_STRATEGY_PUNCHLIST_PROMPT } from './prompts';
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
import { myProvider } from '@/lib/ai/providers';
import { createDocumentBuilder } from '@/lib/ai/prompts/builders';
import { getDomain, type DomainId } from '@/lib/domains';
import { db } from '@/lib/db/queries';
import { workspace } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getObjectiveById } from '@/lib/db/objective';

export const salesStrategyHandler: DocumentHandler<'text'> = {
  kind: 'text',
  metadata,

  onCreateDocument: async ({
    versionId,
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
      objectiveId?: string;
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

    // Load workspace object for builder
    const workspaceData = await db
      .select()
      .from(workspace)
      .where(eq(workspace.id, workspaceId))
      .limit(1);

    const workspaceObject = workspaceData[0] || null;
    const domainId = workspaceObject?.domainId as DomainId;
    const domain = getDomain(domainId);

    // Load objective if provided
    const objectiveObject = typedMetadata?.objectiveId
      ? await getObjectiveById(typedMetadata.objectiveId, session.user.id)
      : null;

    // Use builder to generate system prompt with workspace/objective context
    const builder = createDocumentBuilder('sales-strategy');
    const systemPrompt = builder.generate(
      domain,
      workspaceObject,
      objectiveObject,
    );

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

    await saveGeneratedDocument(versionId, content, {
      documentType: 'sales-strategy',
      sourceDocumentIds: typedMetadata?.sourceDocumentIds || [],
    });

    return { versionId };
  },

  onUpdateDocument: async () => {
    // Legacy - not used in current architecture
    throw new Error(
      'onUpdateDocument is deprecated - use onCreateDocument to update version',
    );
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
