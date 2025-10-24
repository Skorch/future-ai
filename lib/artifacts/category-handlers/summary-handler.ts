import 'server-only';

import type { CategoryHandler, GenerationContext } from './types';
import type { ArtifactType } from '@/lib/db/schema';
import { ArtifactCategory, workspace } from '@/lib/db/schema';
import { SummaryBuilder } from '@/lib/ai/prompts/builders/summary-builder';
import {
  processStream,
  buildStreamConfig,
  fetchSourceDocuments,
} from '@/lib/artifacts/document-types/base-handler';
import { myProvider } from '@/lib/ai/providers';
import { db } from '@/lib/db/queries';
import { eq, and, isNull } from 'drizzle-orm';
import { getObjectiveById } from '@/lib/db/objective';
import { getCurrentVersionGoal } from '@/lib/db/objective-document';
import { getLogger } from '@/lib/logger';

const logger = getLogger('summary-handler');

/**
 * Summary Category Handler
 *
 * Handles all category='summary' artifact types (sales-call-summary, meeting-summary, etc.)
 * Uses database-stored prompts via ArtifactType configuration
 */
export class SummaryHandler implements CategoryHandler {
  readonly category = ArtifactCategory.SUMMARY;

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

    // Load source documents if provided
    const sourceContent = context.sourceDocumentIds
      ? await fetchSourceDocuments(
          context.sourceDocumentIds,
          context.workspaceId,
        )
      : '';

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
      sourceContent,
    );

    // Create stream configuration
    const streamConfig = await buildStreamConfig({
      model: myProvider.languageModel('artifact-model'),
      system: systemPrompt,
      prompt: userPrompt,
      context: context,
      maxOutputTokens: 4000,
      temperature: 0.6,
      chatId: context.chatId,
    });

    // Process stream and return content
    if (!context.dataStream) {
      throw new Error('dataStream is required for summary generation');
    }

    logger.debug('Starting Summary with streamConfig.prompt and userPrompt', {
      artifactType: artifactType.title,
      prompt: streamConfig.prompt,
      userPrompt,
    });

    return processStream(streamConfig, context.dataStream);
  }

  /**
   * Build user prompt with instruction and current version context
   * Follows the same pattern as other category handlers
   */
  private buildPromptWithContext(
    instruction?: string,
    currentVersion?: string,
    sourceContent?: string,
  ): string {
    const parts: string[] = [];

    // 1. Add instruction
    parts.push(
      `## User Instructions\n\n${instruction || 'Generate the summary based on the context.'}`,
    );

    // 2. Add source materials (if provided)
    if (sourceContent) {
      parts.push(`## Source Materials\n\n${sourceContent}`);
    }

    // 3. Add current version and guidance
    if (currentVersion) {
      parts.push(`## Current Version\n\n${currentVersion}`);
      parts.push(
        'Make only the specific changes requested. Preserve all existing valuable content unless explicitly asked to modify it. This is an incremental update, not a rewrite.',
      );
    } else {
      parts.push(
        'Generate a comprehensive initial version using all available context and source materials.',
      );
    }

    return parts.join('\n\n');
  }
}
