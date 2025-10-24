import 'server-only';

import type { CategoryHandler, GenerationContext } from './types';
import type { ArtifactType } from '@/lib/db/schema';
import { ArtifactCategory } from '@/lib/db/schema';
import { ObjectiveContextBuilder } from '@/lib/ai/prompts/builders/specialized/objective-context-builder';
import {
  buildStreamConfig,
  processStream,
} from '../document-types/base-handler';
import { getWorkspaceById } from '@/lib/workspace/queries';
import { getObjectiveById } from '@/lib/db/objective';
import { getDomainById } from '@/lib/db/queries/domain';
import { myProvider } from '@/lib/ai/providers';
import { getLogger } from '@/lib/logger';

const logger = getLogger('ObjectiveContextHandler');

/**
 * Handler for objective context artifacts
 *
 * Generates goal-specific context including objectives, constraints,
 * and success criteria at the objective level.
 */
export class ObjectiveContextHandler implements CategoryHandler {
  readonly category = ArtifactCategory.OBJECTIVE_CONTEXT;

  async generate(
    artifactType: ArtifactType,
    context: GenerationContext,
  ): Promise<string> {
    logger.debug('Generating objective context artifact', {
      workspaceId: context.workspaceId,
      objectiveId: context.objectiveId,
      hasCurrentVersion: !!context.currentVersion,
      hasInstruction: !!context.instruction,
    });

    // Validate objectiveId is present
    if (!context.objectiveId) {
      throw new Error(
        'Objective ID is required for objective context generation',
      );
    }

    // Fetch workspace
    const workspace = await getWorkspaceById(
      context.workspaceId,
      context.session.user.id,
    );
    if (!workspace) {
      throw new Error(
        `Workspace not found: ${context.workspaceId} for user ${context.session.user.id}`,
      );
    }

    // Fetch objective for validation
    const objective = await getObjectiveById(
      context.objectiveId,
      context.session.user.id,
    );
    if (!objective) {
      throw new Error(
        `Objective not found: ${context.objectiveId} for user ${context.session.user.id}`,
      );
    }

    // Fetch domain
    const domain = await getDomainById(workspace.domainId);
    if (!domain) {
      throw new Error(`Domain not found: ${workspace.domainId}`);
    }

    logger.debug('artifactType for objective context generation', {
      artifactTypeId: artifactType.id,
      artifactTypeLabel: artifactType.label,
    });

    const builder = new ObjectiveContextBuilder();
    const systemPrompt = builder.generateContextPrompt(artifactType, domain);

    // Build user prompt with instruction and current version
    const userPrompt = this.buildPromptWithContext(
      context.instruction,
      context.currentVersion,
    );

    // Get model for generation
    const model = myProvider.languageModel('artifact-model');

    // Build stream config
    const streamConfig = await buildStreamConfig({
      model,
      system: systemPrompt,
      prompt: userPrompt,
      context: context,
      maxOutputTokens: 500,
      temperature: 0.3, // Low temperature for consistent context generation
      chatId: context.chatId,
      // thinkingBudget: ThinkingBudget.LOW
    });

    // Enforce dataStream requirement (consistent with summary-handler)
    if (!context.dataStream) {
      throw new Error(
        'dataStream is required for objective context generation',
      );
    }

    // Process stream and return generated content
    const content = await processStream(streamConfig, context.dataStream);

    logger.debug('Objective context artifact generated successfully', {
      contentLength: content.length,
    });

    return content;
  }

  /**
   * Build the user prompt with instruction and current version
   */
  private buildPromptWithContext(
    instruction?: string,
    currentVersion?: string,
  ): string {
    const parts: string[] = [];

    // 1. Add instruction (if provided)
    if (instruction) {
      parts.push(`## User Instructions\n\n${instruction}`);
    }

    // 2. Add current version (if exists)
    if (currentVersion) {
      parts.push(`## Current Context\n\n${currentVersion}`);
    }

    // 3. Add generation guidance
    if (currentVersion) {
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
