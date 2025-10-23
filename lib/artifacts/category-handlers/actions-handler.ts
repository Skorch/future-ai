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
    const systemPrompt = builder.generate(artifactType);

    // 6. Build final user prompt
    const userPrompt = this.buildPromptWithContext(
      context.instruction,
      context.currentVersion,
      knowledgeSummaries,
    );

    // 7. Create stream config with artifact model
    const model = myProvider.languageModel('artifact-model');
    const config = await buildStreamConfig({
      model,
      system: systemPrompt,
      prompt: userPrompt,
      context: context,
      maxOutputTokens: 2000,
      temperature: 0.3,
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
    knowledgeSummaries?: string,
  ): string {
    const parts: string[] = [];

    // Add instruction if provided
    if (instruction) {
      parts.push(`User Instruction:\n${instruction}`);
    }

    // Add appropriate generation guidance
    if (currentVersion) {
      parts.push(`\nCurrent Objective Actions:\n${currentVersion}`);
      parts.push(
        'Make only the specific changes requested. Preserve all existing valuable content unless explicitly asked to modify it. This is an incremental update, not a rewrite.',
      );
    } else if (parts.length === 0) {
      // Default for initial generation
      parts.push(
        'Generate a clear, concise initial version using all available context and source materials.',
      );

      // add the knowledge summaries to the prompt
      if (knowledgeSummaries) {
        parts.push(`\nKnowledge Summaries:\n${knowledgeSummaries}`);
      }
    }

    return parts.join('\n\n');
  }
}
/*

    // Layer 3: Current context for incremental updates
    systemPrompt += `\n\n## Current Context

### Current Document Content
${currentContent}

### Current Objective Actions
${currentObjectiveActions || 'No objective actions yet - this is the first knowledge input. Generate initial objective actions based on the current document content and new knowledge.'}

### New Knowledge to Process
${knowledgeSummaries}

## Your Task
Analyze the new knowledge and update the objective actions to show:
1. Which items are now RESOLVED (knowledge fully addresses them)
2. Which items are MODIFIED (knowledge partially addresses or updates them)
3. NEW items discovered from the knowledge
4. Items that remain unchanged

Always use the full knowledge document title and date for attribution.
At the end, summarize what changed in the "Changes from Knowledge" section.`;
*/
