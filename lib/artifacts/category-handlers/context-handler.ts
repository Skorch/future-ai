import 'server-only';

import type { CategoryHandler, GenerationContext } from './types';
import type { ArtifactType } from '@/lib/db/schema';
import { WorkspaceContextBuilder } from '@/lib/ai/prompts/builders/specialized/workspace-context-builder';
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

const logger = getLogger('ContextHandler');

/**
 * Handler for context category artifacts (workspace context and objective context)
 *
 * This handler supports two types of context:
 * - Workspace context: Broad organizational context (stakeholders, preferences, constraints)
 * - Objective context: Goal-specific context (objectives, constraints, success criteria)
 *
 * The handler automatically determines which type to generate based on whether
 * an objectiveId is present in the generation context.
 */
export class ContextHandler implements CategoryHandler {
  readonly category = 'context' as const;

  async generate(
    artifactType: ArtifactType,
    context: GenerationContext,
  ): Promise<string> {
    const contextType = this.determineContextType(context);

    logger.debug('Generating context artifact', {
      contextType,
      workspaceId: context.workspaceId,
      objectiveId: context.objectiveId,
      hasCurrentVersion: !!context.currentVersion,
      hasInstruction: !!context.instruction,
    });

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

    // Fetch domain
    const domain = await getDomainById(workspace.domainId);
    if (!domain) {
      throw new Error(`Domain not found: ${workspace.domainId}`);
    }

    // Select appropriate builder
    let systemPrompt: string;

    logger.debug('artifactType for context generation', {
      artifactTypeId: artifactType.id,
      artifactTypeLabel: artifactType.label,
    });

    if (contextType === 'objective') {
      // Validate objectiveId is present
      if (!context.objectiveId) {
        throw new Error(
          'Objective ID is required for objective context generation',
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

      const builder = new ObjectiveContextBuilder();
      systemPrompt = builder.generateContextPrompt(artifactType, domain);
    } else {
      const builder = new WorkspaceContextBuilder();
      systemPrompt = builder.generateContextPrompt(artifactType, domain);
    }

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
      throw new Error('dataStream is required for context generation');
    }

    // Process stream and return generated content
    const content = await processStream(streamConfig, context.dataStream);

    logger.debug('Context artifact generated successfully', {
      contextType,
      contentLength: content.length,
    });

    return content;
  }

  /**
   * Determine whether to generate workspace or objective context
   */
  private determineContextType(
    context: GenerationContext,
  ): 'workspace' | 'objective' {
    return context.objectiveId ? 'objective' : 'workspace';
  }

  /**
   * Build the user prompt with instruction and current version
   */
  private buildPromptWithContext(
    instruction?: string,
    currentVersion?: string,
  ): string {
    let prompt = '';

    // Add current version if it exists
    if (currentVersion) {
      prompt += `## Current Context\n\n${currentVersion}\n\n`;
    }

    // Add instruction
    if (instruction) {
      prompt += `## Update Instructions\n\n${instruction}\n\n`;
    }

    // Add generation guidance
    if (currentVersion) {
      prompt +=
        'Make only the specific changes requested. Preserve all existing valuable content unless explicitly asked to modify it. This is an incremental update, not a rewrite.\n\n';
    } else {
      prompt +=
        'Generate a comprehensive initial version using all available context and source materials.\n\n';
    }

    return prompt;
  }
}
