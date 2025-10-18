import type {
  DocumentHandler,
  GeneratePunchlistCallbackProps,
} from '@/lib/artifacts/server';
import { ObjectiveDocumentBuilder } from '@/lib/ai/prompts/builders/objective-document-builder';
import { PunchlistBuilder } from '@/lib/ai/prompts/builders/punchlist-builder';
import {
  fetchSourceDocuments,
  buildStreamConfig,
  processStream,
  saveGeneratedDocument,
  fetchKnowledgeDocuments,
} from '@/lib/artifacts/document-types/base-handler';
import { OutputSize } from '@/lib/artifacts/types';
import { myProvider } from '@/lib/ai/providers';

import { db } from '@/lib/db/queries';
import { workspace, artifactType } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getObjectiveById } from '@/lib/db/objective';
import { metadata } from './metadata';

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

    // Load objective if provided
    const objectiveObject = typedMetadata?.objectiveId
      ? await getObjectiveById(typedMetadata.objectiveId, session.user.id)
      : null;

    // Fetch objectiveDocumentArtifactType from the objective
    if (!objectiveObject?.objectiveDocumentArtifactTypeId) {
      throw new Error(
        'Objective missing objectiveDocumentArtifactTypeId - cannot generate document',
      );
    }

    const [artifactTypeData] = await db
      .select()
      .from(artifactType)
      .where(
        eq(artifactType.id, objectiveObject.objectiveDocumentArtifactTypeId),
      )
      .limit(1);

    if (!artifactTypeData) {
      throw new Error('ArtifactType not found for objective document');
    }

    // Use builder to generate system prompt with artifact type, workspace, and objective
    const builder = new ObjectiveDocumentBuilder();
    const systemPrompt = builder.generate(
      artifactTypeData,
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
    objectiveId,
  }: GeneratePunchlistCallbackProps) => {
    // Fetch knowledge documents with full attribution
    const knowledgeSummaries = await fetchKnowledgeDocuments(knowledgeDocIds);

    if (!knowledgeSummaries) {
      throw new Error(
        'No valid knowledge documents found for punchlist generation',
      );
    }

    // Load objective to get punchlist artifact type
    const objectiveObject = objectiveId
      ? await getObjectiveById(objectiveId, session.user.id)
      : null;

    if (!objectiveObject?.punchlistArtifactTypeId) {
      throw new Error(
        'Objective missing punchlistArtifactTypeId - cannot generate punchlist',
      );
    }

    // Fetch punchlist artifact type
    const [punchlistArtifactType] = await db
      .select()
      .from(artifactType)
      .where(eq(artifactType.id, objectiveObject.punchlistArtifactTypeId))
      .limit(1);

    if (!punchlistArtifactType) {
      throw new Error('PunchlistArtifactType not found');
    }

    // Use PunchlistBuilder to generate system prompt
    const punchlistBuilder = new PunchlistBuilder();
    const punchlistSystemPrompt = punchlistBuilder.generate(
      punchlistArtifactType,
      currentVersion.punchlist,
      currentVersion.content,
      knowledgeSummaries,
    );

    // Build configuration for punchlist generation
    const config = buildStreamConfig({
      model: myProvider.languageModel('claude-sonnet-4'),
      system: punchlistSystemPrompt,
      prompt:
        'Generate the updated punchlist showing how the new knowledge affects each item.',
      maxOutputTokens: 4000,
      temperature: 0.4,
    });

    // Process stream directly
    const punchlistContent = await processStream(config, dataStream);

    // Save punchlist to database
    const { updateVersionPunchlist } = await import(
      '@/lib/db/objective-document'
    );
    await updateVersionPunchlist(currentVersion.id, punchlistContent);

    return punchlistContent;
  },
};
