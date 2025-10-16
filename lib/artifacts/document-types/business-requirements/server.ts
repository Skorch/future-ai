import { myProvider } from '@/lib/ai/providers';
import { metadata } from './metadata';
import { BRD_PUNCHLIST_PROMPT } from './prompts';
import { OutputSize } from '@/lib/artifacts/types';
import {
  processStream,
  saveGeneratedDocument,
  fetchSourceDocuments,
  buildStreamConfig,
  generatePunchlist,
  fetchKnowledgeDocuments,
  GLOBAL_PUNCHLIST_TEMPLATE,
} from '../base-handler';
import type {
  DocumentHandler,
  CreateDocumentCallbackProps,
  GeneratePunchlistCallbackProps,
} from '@/lib/artifacts/server';
import { createDocumentBuilder } from '@/lib/ai/prompts/builders';
import { getDomain, type DomainId } from '@/lib/domains';
import { db } from '@/lib/db/queries';
import { workspace } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getObjectiveById } from '@/lib/db/objective';

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
    const domainId = workspaceObject?.domainId as DomainId;
    const domain = getDomain(domainId);

    // Load objective if provided
    const objectiveObject = typedMetadata?.objectiveId
      ? await getObjectiveById(typedMetadata.objectiveId, session.user.id)
      : null;

    // Use builder to generate system prompt with workspace/objective context
    const builder = createDocumentBuilder('business-requirements');
    const systemPrompt = builder.generate(
      domain,
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

    // Generate punchlist with BRD-specific tracking goals
    const punchlistContent = await generatePunchlist({
      currentPunchlist: currentVersion.punchlist,
      currentContent: currentVersion.content,
      knowledgeSummaries,
      documentSpecificPrompt: BRD_PUNCHLIST_PROMPT,
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
