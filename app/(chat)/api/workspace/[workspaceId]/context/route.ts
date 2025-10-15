import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { generateObject } from 'ai';
import { myProvider } from '@/lib/ai/providers';
import {
  getWorkspaceContext,
  updateWorkspaceContext,
  getWorkspaceById,
} from '@/lib/workspace/queries';
import {
  WORKSPACE_CONTEXT_GENERATION_PROMPT,
  WorkspaceContextSchema,
  formatWorkspaceContextAsMarkdown,
} from '@/lib/ai/prompts/workspace-context-generation';
import { getDomain } from '@/lib/domains';
import { getLogger } from '@/lib/logger';

const logger = getLogger('WorkspaceContextAPI');

// Request body schema for POST (AI-generated update)
const PostRequestSchema = z.object({
  observations: z.array(z.string()).min(1, 'At least one observation required'),
  updateReason: z.enum([
    'new_stakeholder',
    'technical_decision',
    'requirement_clarified',
    'workflow_established',
    'preference_observed',
    'problem_identified',
    'solution_implemented',
    'document_created',
    'initial_setup',
  ]),
});

// Request body schema for PUT (manual update)
const PutRequestSchema = z.object({
  context: z
    .string()
    .max(
      Number.parseInt(process.env.WORKSPACE_CONTEXT_MAX_LENGTH || '10000'),
      `Context cannot exceed ${process.env.WORKSPACE_CONTEXT_MAX_LENGTH || '10000'} characters`,
    ),
});

/**
 * GET - Retrieve current workspace context
 */
export async function GET(
  request: Request,
  props: { params: Promise<{ workspaceId: string }> },
) {
  const params = await props.params;
  const { workspaceId } = params;

  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const contextData = await getWorkspaceContext(workspaceId, userId);

    if (!contextData) {
      return NextResponse.json(
        { error: 'Workspace not found' },
        { status: 404 },
      );
    }

    return NextResponse.json({
      context: contextData.context,
      contextUpdatedAt: contextData.contextUpdatedAt,
    });
  } catch (error) {
    logger.error('Error retrieving workspace context:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve context' },
      { status: 500 },
    );
  }
}

/**
 * POST - AI-generated context update
 * Accepts observations and generates updated context using AI
 */
export async function POST(
  request: Request,
  props: { params: Promise<{ workspaceId: string }> },
) {
  const params = await props.params;
  const { workspaceId } = params;

  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse and validate request body
    const body = await request.json();
    const { observations, updateReason } = PostRequestSchema.parse(body);

    // Get workspace to verify ownership and get domain
    const workspace = await getWorkspaceById(workspaceId, userId);
    if (!workspace) {
      return NextResponse.json(
        { error: 'Workspace not found' },
        { status: 404 },
      );
    }

    // Get current context
    const contextData = await getWorkspaceContext(workspaceId, userId);
    const currentContext = contextData?.context || '';

    // Get domain for domain-specific guidance
    const domain = getDomain(workspace.domainId);

    // Build system prompt: base + domain-specific guidance
    const systemPrompt = `${WORKSPACE_CONTEXT_GENERATION_PROMPT}

## Domain-Specific Guidance

${domain.workspaceContextPrompt}`;

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

    logger.debug('Generating workspace context update', {
      workspaceId,
      updateReason,
      observationCount: observations.length,
      hasCurrentContext: !!currentContext,
    });

    // Generate updated context using AI with structured output
    const { object: updatedContext } = await generateObject({
      model: myProvider.languageModel('title-model'), // claude-3-5-haiku for speed
      schema: WorkspaceContextSchema,
      mode: 'json',
      system: systemPrompt,
      prompt: userPrompt,
      temperature: 0.2, // Low temperature for consistency
    });

    // Convert structured context to markdown
    const markdownContext = formatWorkspaceContextAsMarkdown(updatedContext);

    // Validate length
    const maxLength = Number.parseInt(
      process.env.WORKSPACE_CONTEXT_MAX_LENGTH || '10000',
    );
    if (markdownContext.length > maxLength) {
      return NextResponse.json(
        {
          error: `Generated context exceeds ${maxLength} character limit (${markdownContext.length} chars)`,
        },
        { status: 400 },
      );
    }

    // Save updated context
    await updateWorkspaceContext(workspaceId, userId, markdownContext);

    logger.info('Workspace context updated via AI', {
      workspaceId,
      updateReason,
      contextLength: markdownContext.length,
    });

    return NextResponse.json({
      success: true,
      context: markdownContext,
      updatedSections: Object.keys(updatedContext).filter(
        (key) => updatedContext[key as keyof typeof updatedContext] != null,
      ),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request body', details: error.errors },
        { status: 400 },
      );
    }

    logger.error('Error updating workspace context:', error);
    return NextResponse.json(
      { error: 'Failed to update context' },
      { status: 500 },
    );
  }
}

/**
 * PUT - Manual context update
 * Directly updates context with provided markdown (for Phase 2 UI editor)
 */
export async function PUT(
  request: Request,
  props: { params: Promise<{ workspaceId: string }> },
) {
  const params = await props.params;
  const { workspaceId } = params;

  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse and validate request body
    const body = await request.json();
    const { context } = PutRequestSchema.parse(body);

    // Verify workspace ownership
    const workspace = await getWorkspaceById(workspaceId, userId);
    if (!workspace) {
      return NextResponse.json(
        { error: 'Workspace not found' },
        { status: 404 },
      );
    }

    // Update context
    await updateWorkspaceContext(workspaceId, userId, context);

    logger.info('Workspace context updated manually', {
      workspaceId,
      contextLength: context.length,
    });

    return NextResponse.json({
      success: true,
      context,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request body', details: error.errors },
        { status: 400 },
      );
    }

    logger.error('Error updating workspace context:', error);
    return NextResponse.json(
      { error: 'Failed to update context' },
      { status: 500 },
    );
  }
}
