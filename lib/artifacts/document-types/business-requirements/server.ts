import { myProvider } from '@/lib/ai/providers';
import { ObjectiveDocumentBuilder } from '@/lib/ai/prompts/builders/objective-document-builder';
import { ObjectiveActionsBuilder } from '@/lib/ai/prompts/builders/objective-actions-builder';
import { OutputSize, ThinkingBudget } from '@/lib/artifacts/types';
import {
  processStream,
  saveGeneratedDocument,
  fetchSourceDocuments,
  buildStreamConfig,
  fetchKnowledgeDocuments,
} from '../base-handler';
import type {
  DocumentHandler,
  CreateDocumentCallbackProps,
  GenerateObjectiveActionsCallbackProps,
} from '@/lib/artifacts/server';

import { db } from '@/lib/db/queries';
import { workspace, artifactType } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getObjectiveById } from '@/lib/db/objective';
import { getCurrentVersionGoal } from '@/lib/db/objective-document';
import { metadata } from './metadata';

interface BRDMetadata {
  sourceDocumentIds?: string[];
  projectName?: string;
  clientName?: string;
  version?: string;
  objectiveId?: string;
}

export const businessRequirementsHandler: DocumentHandler<'text'> = {
  kind: 'text',
  metadata,
  onCreateDocument: async ({
    versionId,
    title,
    dataStream,
    metadata: docMetadata,
    workspaceId,
    session,
  }: CreateDocumentCallbackProps) => {
    // Cast metadata to our expected type
    const typedMetadata = docMetadata as BRDMetadata | undefined;

    // Fetch source documents (required for BRD)
    if (!typedMetadata?.sourceDocumentIds?.length) {
      throw new Error(
        'Business Requirements Documents require sourceDocumentIds to fetch meeting transcripts',
      );
    }

    const transcripts = await fetchSourceDocuments(
      typedMetadata.sourceDocumentIds,
      workspaceId,
    );

    if (!transcripts) {
      throw new Error('No valid source documents found');
    }

    // Extract metadata parameters
    const projectName = typedMetadata?.projectName || title;
    const clientName = typedMetadata?.clientName || 'Client';
    const version = typedMetadata?.version || '1.0';

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

    // Build user prompt
    const userPrompt = `Create a comprehensive Business Requirements Document from these meeting transcripts:

Project: ${projectName}
Client: ${clientName}
Version: ${version}
Date: ${new Date().toISOString().split('T')[0]}

Meeting Transcripts and Documentation:
${transcripts}`;

    // Build configuration with high thinking budget for complex synthesis
    const streamConfig = buildStreamConfig({
      model: myProvider.languageModel('artifact-model'),
      system: systemPrompt,
      prompt: userPrompt,
      maxOutputTokens: metadata.outputSize ?? OutputSize.LARGE,
      thinkingBudget: metadata.thinkingBudget, // HIGH - 12000 tokens
    });

    // Process the stream and collect content
    const content = await processStream(streamConfig, dataStream);

    // Save the generated document
    await saveGeneratedDocument(versionId, content, {
      documentType: 'business-requirements',
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
