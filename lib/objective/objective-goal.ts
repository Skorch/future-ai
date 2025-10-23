'use server';
import { auth } from '@clerk/nextjs/server';
import { generateObject } from 'ai';
import { revalidatePath } from 'next/cache';
import { getLogger } from '@/lib/logger';
import { getObjectiveById } from '@/lib/db/objective';
import { getUserById } from '@/lib/db/queries';
import {
  ObjectiveContextSchema,
  formatObjectiveContextAsMarkdown,
  type ObjectiveContext,
} from '@/lib/ai/prompts/objective-context-generation';
import { getWorkspaceById } from '@/lib/workspace/queries';
import { myProvider } from '@/lib/ai/providers';
import { ObjectiveContextBuilder } from '@/lib/ai/prompts/builders';
import { CORE_SYSTEM_PROMPT } from '@/lib/ai/prompts/system';
import { getCurrentContext } from '@/lib/ai/prompts/current-context';
import {
  getCurrentVersionGoal,
  updateObjectiveGoal,
} from '@/lib/db/objective-document';
import { OBJECTIVE_FIELD_MAX_LENGTH } from './constants';

const logger = getLogger('ObjectiveGoal');

/**
 * AI-powered objective goal generation
 */
export async function generateObjectiveGoal({
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
    logger.debug('Generating objective goal', {
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

    // Get current goal using the new DAL
    const versionData = await getCurrentVersionGoal(objectiveId, userId);
    const existingGoal = versionData?.goal || '';

    // Get workspace for domain
    const workspace = await getWorkspaceById(workspaceId, userId);
    if (!workspace) {
      return { success: false, error: 'Workspace not found' };
    }

    // Load objective with artifact type and domain for context builder
    const { db } = await import('@/lib/db/queries');
    const { objective: objectiveSchema, domain: domainSchema } = await import(
      '@/lib/db/schema'
    );
    const { eq } = await import('drizzle-orm');

    const objectiveWithRelations = await db.query.objective.findFirst({
      where: eq(objectiveSchema.id, objectiveId),
      with: {
        objectiveContextArtifactType: true,
      },
    });

    if (!objectiveWithRelations?.objectiveContextArtifactType) {
      logger.error('Objective missing objectiveContextArtifactType', {
        objectiveId,
      });
      return {
        success: false,
        error: 'Objective configuration error: missing artifact type',
      };
    }

    // Load domain from database
    const [domainRecord] = await db
      .select()
      .from(domainSchema)
      .where(eq(domainSchema.id, workspace.domainId))
      .limit(1);

    if (!domainRecord) {
      logger.error('Domain not found', { domainId: workspace.domainId });
      return {
        success: false,
        error: 'Domain configuration error',
      };
    }

    // Get user for context
    const user = await getUserById(userId);

    // Build system prompt using builder
    const builder = new ObjectiveContextBuilder();
    const domainPrompt = builder.generateContextPrompt(
      objectiveWithRelations.objectiveContextArtifactType,
      domainRecord,
    );

    // Manually prepend core system layers (since we're not using buildStreamConfig)
    const fullSystemPrompt = `${CORE_SYSTEM_PROMPT}

${getCurrentContext({ user })}

${domainPrompt}`;

    // Build user prompt with current goal and observations
    const userPrompt = `
${existingGoal ? `## Current Objective Goal\n\n${existingGoal}\n\n` : '## Current Objective Goal\n\nNo goal established yet.\n\n'}
## New Observations to Incorporate

Update Reason: ${updateReason}

Observations:
${observations.map((obs, i) => `${i + 1}. ${obs}`).join('\n')}

## Task

Update the objective goal by incorporating these new observations. Focus on THIS specific objective.
`;

    logger.debug('Calling AI to generate goal update', {
      objectiveId,
      updateReason,
      hasCurrentGoal: !!existingGoal,
    });

    // Generate updated goal using AI with structured output
    const { object: structuredContext } = await generateObject({
      model: myProvider.languageModel('title-model'), // claude-3-5-haiku for speed
      schema: ObjectiveContextSchema,
      mode: 'json',
      system: fullSystemPrompt,
      prompt: userPrompt,
      temperature: 0.2,
    });

    // Convert structured context to markdown
    const formattedGoal = formatObjectiveContextAsMarkdown(structuredContext);

    // Validate length
    if (formattedGoal.length > OBJECTIVE_FIELD_MAX_LENGTH) {
      logger.error('Generated goal exceeds limit', {
        length: formattedGoal.length,
        maxLength: OBJECTIVE_FIELD_MAX_LENGTH,
      });
      return {
        success: false,
        error: `Generated goal exceeds ${OBJECTIVE_FIELD_MAX_LENGTH} character limit (${formattedGoal.length} chars)`,
      };
    }

    // Save updated goal using the new DAL
    if (versionData) {
      await updateObjectiveGoal(versionData.versionId, userId, formattedGoal);
    }

    const updatedSections = Object.keys(structuredContext).filter(
      (key) => structuredContext[key as keyof typeof structuredContext] != null,
    );

    logger.info('Objective goal generated and saved successfully', {
      objectiveId,
      updateReason,
      goalLength: formattedGoal.length,
      updatedSections,
      duration: Date.now() - startTime,
    });

    return {
      success: true,
      markdown: formattedGoal,
      structuredContext,
      updatedSections,
    };
  } catch (error) {
    logger.error('Error generating objective goal', {
      error,
      objectiveId,
      updateReason,
    });
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Unknown error generating goal',
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

  if (context.length > OBJECTIVE_FIELD_MAX_LENGTH) {
    return {
      error: `Context exceeds ${OBJECTIVE_FIELD_MAX_LENGTH} character limit`,
    };
  }

  try {
    // Get current version
    const versionData = await getCurrentVersionGoal(objectiveId, userId);
    if (!versionData) {
      return { error: 'No version found for objective' };
    }

    // Update using the new DAL
    await updateObjectiveGoal(versionData.versionId, userId, context);
    revalidatePath(`/workspace/[workspaceId]/objective/${objectiveId}`);

    logger.info('Objective goal updated manually', {
      objectiveId,
      contextLength: context.length,
    });

    return {};
  } catch (error) {
    logger.error('Error updating objective goal manually', {
      error,
      objectiveId,
    });
    return { error: 'Failed to update goal' };
  }
}
