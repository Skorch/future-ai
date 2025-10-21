import type {
  DocumentHandler,
  GenerateObjectiveActionsCallbackProps,
} from '@/lib/artifacts/server';
import { ObjectiveDocumentBuilder } from '@/lib/ai/prompts/builders/objective-document-builder';
import { ObjectiveActionsBuilder } from '@/lib/ai/prompts/builders/objective-actions-builder';
import {
  fetchSourceDocuments,
  buildStreamConfig,
  processStream,
  saveGeneratedDocument,
  fetchKnowledgeDocuments,
} from '@/lib/artifacts/document-types/base-handler';
import { OutputSize, ThinkingBudget } from '@/lib/artifacts/types';
import { myProvider } from '@/lib/ai/providers';

import { db } from '@/lib/db/queries';
import { workspace, artifactType } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getObjectiveById } from '@/lib/db/objective';
import { getCurrentVersionGoal } from '@/lib/db/objective-document';
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

    // Fetch objective goal from current version
    const goalData = typedMetadata?.objectiveId
      ? await getCurrentVersionGoal(typedMetadata.objectiveId, session.user.id)
      : null;
    const objectiveGoal = goalData?.goal ?? null;

    // Use builder to generate system prompt with artifact type, workspace, and objective
    const builder = new ObjectiveDocumentBuilder();
    const systemPrompt = builder.generate(
      artifactTypeData,
      workspaceObject,
      objectiveObject,
      objectiveGoal,
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
  onGenerateObjectiveActions: async ({
    currentVersion,
    knowledgeDocIds,
    instruction,
    dataStream,
    workspaceId,
    session,
    objectiveId,
  }: GenerateObjectiveActionsCallbackProps) => {
    // Fetch knowledge documents with full attribution
    const knowledgeSummaries = await fetchKnowledgeDocuments(knowledgeDocIds);

    if (!knowledgeSummaries) {
      throw new Error(
        'No valid knowledge documents found for objective actions generation',
      );
    }

    // Load objective to get objective actions artifact type
    const objectiveObject = objectiveId
      ? await getObjectiveById(objectiveId, session.user.id)
      : null;

    if (!objectiveObject?.objectiveActionsArtifactTypeId) {
      throw new Error(
        'Objective missing objectiveActionsArtifactTypeId - cannot generate objective actions',
      );
    }

    // Fetch objective actions artifact type
    const [objectiveActionsArtifactType] = await db
      .select()
      .from(artifactType)
      .where(
        eq(artifactType.id, objectiveObject.objectiveActionsArtifactTypeId),
      )
      .limit(1);

    if (!objectiveActionsArtifactType) {
      throw new Error('ObjectiveActionsArtifactType not found');
    }

    // Use ObjectiveActionsBuilder to generate system prompt
    const objectiveActionsBuilder = new ObjectiveActionsBuilder();
    const objectiveActionsSystemPrompt = objectiveActionsBuilder.generate(
      objectiveActionsArtifactType,
      currentVersion.objectiveActions,
      currentVersion.content,
      knowledgeSummaries,
    );

    // Build configuration for objective actions generation
    const config = buildStreamConfig({
      model: myProvider.languageModel('claude-sonnet-4'),
      system: objectiveActionsSystemPrompt,
      prompt:
        'Generate the updated objective actions showing how the new knowledge affects each item.',
      maxOutputTokens: 4000,
      temperature: 0.4,
      thinkingBudget: ThinkingBudget.MEDIUM, // 8000 tokens for objective analysis
    });

    // Process stream directly
    const objectiveActionsContent = await processStream(config, dataStream);

    // Save objective actions to database
    const { updateVersionObjectiveActions } = await import(
      '@/lib/db/objective-document'
    );
    await updateVersionObjectiveActions(
      currentVersion.id,
      objectiveActionsContent,
    );

    return objectiveActionsContent;
  },
};
