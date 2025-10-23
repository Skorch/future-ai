/**
 * Actions Handler
 * Handles category='objectiveActions' artifact generation
 * Tracks and updates objective actions based on new knowledge inputs
 */

import type { ArtifactType } from '@/lib/db/schema';
import type { CategoryHandler, GenerationContext } from './types';
import { ObjectiveActionsBuilder } from '@/lib/ai/prompts/builders';
import {
  processStream,
  buildStreamConfig,
  fetchKnowledgeDocuments,
} from '@/lib/artifacts/document-types/base-handler';
import { getObjectiveById } from '@/lib/db/objective';
import {
  getCurrentVersionObjectiveActions,
  getDocumentByObjectiveId,
} from '@/lib/db/objective-document';
import { myProvider } from '@/lib/ai/providers';

export class ActionsHandler implements CategoryHandler {
  readonly category = 'objectiveActions' as const;

  async generate(
    artifactType: ArtifactType,
    context: GenerationContext,
  ): Promise<string> {
    // Validate objectiveId is present
    if (!context.objectiveId) {
      throw new Error(
        'objectiveId is required for objectiveActions generation',
      );
    }

    // 1. Fetch objective to verify access
    const objective = await getObjectiveById(
      context.objectiveId,
      context.session.user.id,
    );

    if (!objective) {
      throw new Error('Objective not found or access denied');
    }

    // 2. Get current objective actions from latest version
    const actionsData = await getCurrentVersionObjectiveActions(
      context.objectiveId,
      context.session.user.id,
    );

    const currentObjectiveActions = actionsData?.objectiveActions ?? null;

    // 3. Get current document content from latest version
    const documentData = await getDocumentByObjectiveId(context.objectiveId);
    const currentContent = documentData?.latestVersion?.content ?? '';

    // 4. Load knowledge documents if provided
    const knowledgeSummaries = context.knowledgeDocIds
      ? await fetchKnowledgeDocuments(context.knowledgeDocIds)
      : '';

    // 5. Build prompt using ObjectiveActionsBuilder
    const builder = new ObjectiveActionsBuilder();
    const systemPrompt = builder.generate(
      artifactType,
      currentObjectiveActions,
      currentContent,
      knowledgeSummaries,
    );

    // 6. Build final user prompt
    const userPrompt = this.buildPromptWithContext(
      context.instruction,
      context.currentVersion,
    );

    // 7. Create stream config with artifact model
    const model = myProvider.languageModel('artifact-model');
    const config = await buildStreamConfig({
      model,
      system: systemPrompt,
      prompt: userPrompt,
      maxOutputTokens: 16000,
      temperature: 0.6,
      chatId: context.chatId,
    });

    // 8. Process stream and return content
    if (!context.dataStream) {
      throw new Error('dataStream is required for streaming generation');
    }

    return processStream(config, context.dataStream);
  }

  /**
   * Build user prompt incorporating instruction and current state
   */
  private buildPromptWithContext(
    instruction?: string,
    currentVersion?: string,
  ): string {
    const parts: string[] = [];

    // Add instruction if provided
    if (instruction) {
      parts.push(`User Instruction:\n${instruction}`);
    }

    // Add current state context if this is an update
    if (currentVersion) {
      parts.push(
        `\nCurrent Objective Actions (for context):\n${currentVersion}`,
      );
      parts.push(
        '\nNote: The "Current Objective Actions" in the system prompt is the authoritative version. Use this version only for additional context if needed.',
      );
    }

    // Default prompt if nothing provided
    if (parts.length === 0) {
      parts.push(
        'Analyze the new knowledge and update the objective actions accordingly.',
      );
    }

    return parts.join('\n\n');
  }
}
