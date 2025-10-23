import 'server-only';

import type { CategoryHandler, GenerationContext } from './types';
import type { ArtifactType } from '@/lib/db/schema';
import { SummaryBuilder } from '@/lib/ai/prompts/builders/summary-builder';
import {
  processStream,
  buildStreamConfig,
} from '@/lib/artifacts/document-types/base-handler';
import { myProvider } from '@/lib/ai/providers';
import { db } from '@/lib/db/queries';
import { workspace } from '@/lib/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { getObjectiveById } from '@/lib/db/objective';
import { getCurrentVersionGoal } from '@/lib/db/objective-document';

/**
 * Summary Category Handler
 *
 * Handles all category='summary' artifact types (sales-call-summary, meeting-summary, etc.)
 * Uses database-stored prompts via ArtifactType configuration
 */
export class SummaryHandler implements CategoryHandler {
  readonly category = 'summary' as const;

  async generate(
    artifactType: ArtifactType,
    context: GenerationContext,
  ): Promise<string> {
    // Fetch workspace for context
    const [ws] = await db
      .select()
      .from(workspace)
      .where(
        and(
          eq(workspace.id, context.workspaceId),
          eq(workspace.userId, context.session.user.id),
          isNull(workspace.deletedAt),
        ),
      )
      .limit(1);

    const workspaceObject = ws || null;

    // Fetch objective if provided
    const objectiveObject = context.objectiveId
      ? await getObjectiveById(context.objectiveId, context.session.user.id)
      : null;

    // Fetch objective goal from current version
    const goalData = context.objectiveId
      ? await getCurrentVersionGoal(
          context.objectiveId,
          context.session.user.id,
        )
      : null;
    const objectiveGoal = goalData?.goal ?? null;

    // Use SummaryBuilder to generate system prompt with all context layers
    const builder = new SummaryBuilder();
    const systemPrompt = builder.generate(
      artifactType,
      workspaceObject,
      objectiveObject,
      objectiveGoal,
    );

    // Build final user prompt with instruction and current version
    const userPrompt = this.buildPromptWithContext(
      context.instruction,
      context.currentVersion,
    );

    // Create stream configuration
    const streamConfig = await buildStreamConfig({
      model: myProvider.languageModel('artifact-model'),
      system: systemPrompt,
      prompt: userPrompt,
      maxOutputTokens: 4000,
      temperature: 0.6,
      chatId: context.chatId,
    });

    // Process stream and return content
    if (!context.dataStream) {
      throw new Error('dataStream is required for summary generation');
    }

    return processStream(streamConfig, context.dataStream);
  }

  /**
   * Build user prompt with instruction and current version context
   * Follows the same pattern as other category handlers
   */
  private buildPromptWithContext(
    instruction?: string,
    currentVersion?: string,
  ): string {
    let prompt = instruction || 'Generate the summary based on the context.';

    // If updating existing content, append current version as source
    if (currentVersion) {
      prompt += `\n\n## Current Version (for reference)\n\n${currentVersion}`;
    }

    return prompt;
  }
}
