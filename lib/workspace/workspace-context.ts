'use server';
import { auth } from '@clerk/nextjs/server';
import { generateObject } from 'ai';
import { revalidatePath } from 'next/cache';
import { getLogger } from '@/lib/logger';
import {
  updateWorkspaceContext as updateWorkspaceContextDB,
  getWorkspaceContext,
  getWorkspaceById,
} from './queries';
import { getUserById } from '@/lib/db/queries';
import {
  WorkspaceContextSchema,
  formatWorkspaceContextAsMarkdown,
  type WorkspaceContext,
} from '@/lib/ai/prompts/workspace-context-generation';
import { myProvider } from '@/lib/ai/providers';
import { WorkspaceContextBuilder } from '@/lib/ai/prompts/builders';

const logger = getLogger('WorkspaceContext');

/**
 * AI-powered workspace context generation
 * Takes observations and generates structured context using domain-specific guidance
 */
export async function generateWorkspaceContext({
  workspaceId,
  userId,
  observations,
  updateReason,
}: {
  workspaceId: string;
  userId: string;
  observations: string[];
  updateReason:
    | 'new_stakeholder'
    | 'technical_decision'
    | 'requirement_clarified'
    | 'workflow_established'
    | 'preference_observed'
    | 'problem_identified'
    | 'solution_implemented'
    | 'document_created'
    | 'initial_setup';
}): Promise<{
  success: boolean;
  markdown?: string;
  structuredContext?: WorkspaceContext;
  updatedSections?: string[];
  error?: string;
}> {
  const startTime = Date.now();

  try {
    logger.debug('Generating workspace context', {
      workspaceId,
      updateReason,
      observationCount: observations.length,
    });

    // Get workspace to verify ownership and get domain
    const workspace = await getWorkspaceById(workspaceId, userId);
    if (!workspace) {
      logger.error('Workspace not found', { workspaceId, userId });
      return {
        success: false,
        error: 'Workspace not found',
      };
    }

    // Get current context
    const contextData = await getWorkspaceContext(workspaceId, userId);
    const currentContext = contextData?.context || '';

    // Load workspace with artifact type and domain for context builder
    const { db } = await import('@/lib/db/queries');
    const { workspace: workspaceSchema, domain: domainSchema } = await import(
      '@/lib/db/schema'
    );
    const { eq } = await import('drizzle-orm');

    const workspaceWithRelations = await db.query.workspace.findFirst({
      where: eq(workspaceSchema.id, workspaceId),
      with: {
        workspaceContextArtifactType: true,
      },
    });

    if (!workspaceWithRelations?.workspaceContextArtifactType) {
      logger.error('Workspace missing workspaceContextArtifactType', {
        workspaceId,
      });
      return {
        success: false,
        error: 'Workspace configuration error: missing artifact type',
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
    const builder = new WorkspaceContextBuilder();
    const systemPrompt = builder.generateContextPrompt(
      workspaceWithRelations.workspaceContextArtifactType,
      domainRecord,
      user,
    );

    // Build user prompt with current context and observations
    const userPrompt = `
${currentContext ? `## Current Workspace Context\n\n${currentContext}\n\n` : '## Current Workspace Context\n\nNo context has been established yet.\n\n'}
## New Observations to Incorporate

Update Reason: ${updateReason}

Observations:
${observations.map((obs, i) => `${i + 1}. ${obs}`).join('\n')}

## Task

Review the current workspace context and incorporate the new observations following all quality criteria and guidelines. Return the updated context as a structured object.

If this is the first update (no current context), create an initial context based on the observations.

Ensure:
1. All updates are evidence-based (from the observations)
2. Information is workspace-level (not objective/project-specific)
3. Content is well-organized and concise
4. Outdated information is replaced, not duplicated
`;

    logger.debug('Calling AI to generate context update', {
      workspaceId,
      updateReason,
      hasCurrentContext: !!currentContext,
    });

    // Generate updated context using AI with structured output
    const { object: structuredContext } = await generateObject({
      model: myProvider.languageModel('title-model'), // claude-3-5-haiku for speed
      schema: WorkspaceContextSchema,
      mode: 'json',
      system: systemPrompt,
      prompt: userPrompt,
      temperature: 0.2, // Low temperature for consistency
    });

    // Convert structured context to markdown
    const markdown = formatWorkspaceContextAsMarkdown(structuredContext);

    // Validate length
    const maxLength = Number.parseInt(
      process.env.WORKSPACE_CONTEXT_MAX_LENGTH || '5000',
    );
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
    await updateWorkspaceContextDB(workspaceId, userId, markdown);

    const updatedSections = Object.keys(structuredContext).filter(
      (key) => structuredContext[key as keyof typeof structuredContext] != null,
    );

    logger.info('Workspace context generated and saved successfully', {
      workspaceId,
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
    logger.error('Error generating workspace context', {
      error,
      workspaceId,
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
 * Server action to manually update workspace context (for UI editor)
 */
export async function updateWorkspaceContextAction(
  workspaceId: string,
  context: string,
): Promise<undefined | { error: string }> {
  const { userId } = await auth();
  if (!userId) {
    return { error: 'Unauthorized' };
  }

  // Get max length from env (default 5K)
  const maxLength = Number.parseInt(
    process.env.WORKSPACE_CONTEXT_MAX_LENGTH || '5000',
  );

  if (context.length > maxLength) {
    return { error: `Context exceeds ${maxLength} character limit` };
  }

  try {
    await updateWorkspaceContextDB(workspaceId, userId, context);
    revalidatePath(`/workspace/${workspaceId}`);

    logger.info('Workspace context updated manually', {
      workspaceId,
      contextLength: context.length,
    });

    return undefined;
  } catch (error) {
    logger.error('Error updating workspace context manually', {
      error,
      workspaceId,
    });
    return { error: 'Failed to update context' };
  }
}
