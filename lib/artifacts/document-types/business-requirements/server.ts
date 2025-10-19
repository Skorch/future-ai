import { myProvider } from '@/lib/ai/providers';
import { ObjectiveDocumentBuilder } from '@/lib/ai/prompts/builders/objective-document-builder';
import { PunchlistBuilder } from '@/lib/ai/prompts/builders/punchlist-builder';
import { OutputSize } from '@/lib/artifacts/types';
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
  GeneratePunchlistCallbackProps,
} from '@/lib/artifacts/server';
import { buildInvestigationTools } from '@/lib/ai/tools/investigation-tools';

import { db } from '@/lib/db/queries';
import { workspace, artifactType } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getObjectiveById } from '@/lib/db/objective';
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

    // Use builder to generate system prompt with artifact type, workspace, and objective
    const builder = new ObjectiveDocumentBuilder();
    const systemPrompt = builder.generate(
      artifactTypeData,
      workspaceObject,
      objectiveObject,
    );

    // Build user prompt
    const userPrompt = `Create a comprehensive Business Requirements Document from these meeting transcripts:

Project: ${projectName}
Client: ${clientName}
Version: ${version}
Date: ${new Date().toISOString().split('T')[0]}

Meeting Transcripts and Documentation:
${transcripts}`;

    // Build investigation tools for AI to discover information
    const tools = await buildInvestigationTools({
      session,
      workspaceId,
      objectiveId: typedMetadata?.objectiveId || '',
      domainId: 'project',
      dataStream,
    });

    // Build configuration with high thinking budget for complex synthesis
    const streamConfig = buildStreamConfig({
      model: myProvider.languageModel('artifact-model'),
      system: systemPrompt,
      prompt: userPrompt,
      maxOutputTokens: metadata.outputSize ?? OutputSize.LARGE,
      thinkingBudget: metadata.thinkingBudget, // HIGH - 12000 tokens
      tools,
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

    // Build investigation tools for punchlist generation
    const tools = await buildInvestigationTools({
      session,
      workspaceId,
      objectiveId: objectiveId || '',
      domainId: 'project',
      dataStream,
    });

    // Build configuration for punchlist generation with tools
    const config = buildStreamConfig({
      model: myProvider.languageModel('claude-sonnet-4'),
      system: punchlistSystemPrompt,
      prompt:
        'Generate the updated punchlist showing how the new knowledge affects each item.',
      maxOutputTokens: 4000,
      temperature: 0.4,
      tools,
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
