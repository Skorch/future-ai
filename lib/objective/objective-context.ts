'use server';
import { auth } from '@clerk/nextjs/server';
import { generateObject } from 'ai';
import { revalidatePath } from 'next/cache';
import { getLogger } from '@/lib/logger';
import {
  updateObjectiveContext as updateObjectiveContextDB,
  getObjectiveContext,
  getObjectiveById,
} from '@/lib/db/objective';
import {
  ObjectiveContextSchema,
  formatObjectiveContextAsMarkdown,
  type ObjectiveContext,
} from '@/lib/ai/prompts/objective-context-generation';
import { getDomain } from '@/lib/domains';
import { getWorkspaceById } from '@/lib/workspace/queries';
import { myProvider } from '@/lib/ai/providers';
import { ObjectiveContextBuilder } from '@/lib/ai/prompts/builders';

const logger = getLogger('ObjectiveContext');

/**
 * AI-powered objective context generation
 */
export async function generateObjectiveContext({
  objectiveId,
  workspaceId,
  userId,
  observations,
  updateReason,
}: {
  objectiveId: string;
  workspaceId: string;
  userId: string;
  observations: string[];
  updateReason: string;
}): Promise<{
  success: boolean;
  markdown?: string;
  structuredContext?: ObjectiveContext;
  updatedSections?: string[];
  error?: string;
}> {
  const startTime = Date.now();

  try {
    logger.debug('Generating objective context', {
      objectiveId,
      updateReason,
      observationCount: observations.length,
    });

    // Get objective to verify ownership and get workspace
    const objective = await getObjectiveById(objectiveId, userId);
    if (!objective) {
      logger.error('Objective not found', { objectiveId, userId });
      return {
        success: false,
        error: 'Objective not found',
      };
    }

    // Get current context
    const contextData = await getObjectiveContext(objectiveId, userId);
    const currentContext = contextData?.context || '';

    // Get domain for domain-specific guidance
    const workspace = await getWorkspaceById(workspaceId, userId);
    if (!workspace) {
      return { success: false, error: 'Workspace not found' };
    }
    const domain = getDomain(workspace.domainId);

    // Build system prompt using builder
    const builder = new ObjectiveContextBuilder();
    const systemPrompt = builder.generateContextPrompt(domain);

    // Build user prompt with current context and observations
    const userPrompt = `
${currentContext ? `## Current Objective Context\n\n${currentContext}\n\n` : '## Current Objective Context\n\nNo context established yet.\n\n'}
## New Observations to Incorporate

Update Reason: ${updateReason}

Observations:
${observations.map((obs, i) => `${i + 1}. ${obs}`).join('\n')}

## Task

Update the objective context by incorporating these new observations. Focus on THIS specific objective.
`;

    logger.debug('Calling AI to generate context update', {
      objectiveId,
      updateReason,
      hasCurrentContext: !!currentContext,
    });

    // Generate updated context using AI with structured output
    const { object: structuredContext } = await generateObject({
      model: myProvider.languageModel('title-model'), // claude-3-5-haiku for speed
      schema: ObjectiveContextSchema,
      mode: 'json',
      system: systemPrompt,
      prompt: userPrompt,
      temperature: 0.2,
    });

    // Convert structured context to markdown
    const markdown = formatObjectiveContextAsMarkdown(structuredContext);

    // Validate length (5K max)
    const maxLength = 5000;
    if (markdown.length > maxLength) {
      logger.error('Generated context exceeds limit', {
        length: markdown.length,
        maxLength,
      });
      return {
        success: false,
        error: `Generated context exceeds ${maxLength} character limit (${markdown.length} chars)`,
      };
    }

    // Save updated context
    await updateObjectiveContextDB(objectiveId, userId, markdown);

    const updatedSections = Object.keys(structuredContext).filter(
      (key) => structuredContext[key as keyof typeof structuredContext] != null,
    );

    logger.info('Objective context generated and saved successfully', {
      objectiveId,
      updateReason,
      contextLength: markdown.length,
      updatedSections,
      duration: Date.now() - startTime,
    });

    return {
      success: true,
      markdown,
      structuredContext,
      updatedSections,
    };
  } catch (error) {
    logger.error('Error generating objective context', {
      error,
      objectiveId,
      updateReason,
    });
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Unknown error generating context',
    };
  }
}

/**
 * Server action to manually update objective context (for UI editor)
 */
export async function updateObjectiveContextAction(
  objectiveId: string,
  context: string,
): Promise<{ error?: string }> {
  const { userId } = await auth();
  if (!userId) {
    return { error: 'Unauthorized' };
  }

  const maxLength = 5000;

  if (context.length > maxLength) {
    return { error: `Context exceeds ${maxLength} character limit` };
  }

  try {
    await updateObjectiveContextDB(objectiveId, userId, context);
    revalidatePath(`/workspace/[workspaceId]/objective/${objectiveId}`);

    logger.info('Objective context updated manually', {
      objectiveId,
      contextLength: context.length,
    });

    return {};
  } catch (error) {
    logger.error('Error updating objective context manually', {
      error,
      objectiveId,
    });
    return { error: 'Failed to update context' };
  }
}
