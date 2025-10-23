import { tool } from 'ai';
import { z } from 'zod';
import { getLogger } from '@/lib/logger';
import { getCategoryHandler } from '@/lib/artifacts/category-handlers';
import {
  getWorkspaceById,
  getWorkspaceContext,
  updateWorkspaceContext as updateContextInDB,
} from '@/lib/workspace/queries';

const logger = getLogger('UpdateWorkspaceContext');

interface UpdateWorkspaceContextParams {
  session: { user: { id: string } };
  workspaceId: string;
  chatId?: string;
}

/**
 * AI tool for updating workspace context
 * Thin wrapper around the POST /api/workspace/[workspaceId]/context endpoint
 */
export const updateWorkspaceContext = ({
  session,
  workspaceId,
  chatId,
}: UpdateWorkspaceContextParams) =>
  tool({
    description: `Update the workspace context with newly observed facts about the user, their work, company, team, processes, or preferences.

CRITICAL RULES:
- Only record CONFIRMED FACTS that you've directly observed in conversation or documents
- NEVER speculate, assume, or infer information
- Focus on workspace-level information (applies across multiple conversations/objectives)
- DO NOT include objective-specific, project-specific, or deal-specific details

Use this tool when you observe:
- User identity, role, or company information
- Products/services the user works with
- Team members and their roles
- Standard workflows or processes
- Terminology, jargon, or abbreviations
- Communication or documentation preferences
- Common corrections the user makes to your outputs

EXAMPLES OF GOOD OBSERVATIONS:
- "User confirmed they are Sarah Chen, VP of Sales at TechCorp"
- "User mentioned they sell two products: DataFlow Enterprise ($50K/year) and DataFlow Cloud (SaaS)"
- "User corrected my terminology: they call it 'prospect' not 'lead'"
- "User stated their sales process: Discovery → Demo → Trial → Proposal → Close"

EXAMPLES OF BAD OBSERVATIONS (DO NOT USE):
- "User seems to prefer formal communication" (speculation)
- "Acme Corp deal is at Discovery stage" (deal-specific, not workspace-level)
- "User probably has 20 employees" (assumption)
- "They might need feature X" (not confirmed)

The workspace context helps you provide better assistance in future conversations by remembering key facts about the user's work environment.`,

    inputSchema: z.object({
      observations: z
        .array(z.string())
        .min(1)
        .describe(
          'Array of confirmed facts to incorporate into workspace context. Each observation must be evidence-based, not speculative.',
        ),
      updateReason: z
        .enum([
          'new_stakeholder',
          'technical_decision',
          'requirement_clarified',
          'workflow_established',
          'preference_observed',
          'problem_identified',
          'solution_implemented',
          'document_created',
          'initial_setup',
        ])
        .describe(
          'Category for this update. Use initial_setup for the first context update, preference_observed for user corrections/preferences, workflow_established for process discoveries, new_stakeholder for team member mentions.',
        ),
    }),

    execute: async ({ observations, updateReason }) => {
      logger.debug('Tool called: updateWorkspaceContext', {
        workspaceId,
        updateReason,
        observationCount: observations.length,
      });

      try {
        // Get workspace to verify ownership and get artifact type
        const workspace = await getWorkspaceById(workspaceId, session.user.id);
        if (!workspace) {
          logger.error('Workspace not found', {
            workspaceId,
            userId: session.user.id,
          });
          return {
            success: false,
            error: 'Workspace not found',
          };
        }

        // Get category handler for workspace context
        const { handler, artifactType } = await getCategoryHandler(
          workspace.workspaceContextArtifactTypeId,
        );

        // Get current workspace context
        const contextData = await getWorkspaceContext(
          workspaceId,
          session.user.id,
        );
        const currentContext = contextData?.context || undefined;

        // Build instruction from observations and update reason
        const instruction = `Update Reason: ${updateReason}

Observations:
${observations.map((obs, i) => `${i + 1}. ${obs}`).join('\n')}

## Task

Review the current workspace context and incorporate the new observations following all quality criteria and guidelines. Return the updated context as markdown.

If this is the first update (no current context), create an initial context based on the observations.

Ensure:
1. All updates are evidence-based (from the observations)
2. Information is workspace-level (not objective/project-specific)
3. Content is well-organized and concise
4. Outdated information is replaced, not duplicated`;

        // Generate using category handler
        const updatedContext = await handler.generate(artifactType, {
          currentVersion: currentContext,
          instruction,
          workspaceId,
          chatId,
          session,
        });

        // Validate length
        const maxLength = Number.parseInt(
          process.env.WORKSPACE_CONTEXT_MAX_LENGTH || '5000',
        );
        if (updatedContext.length > maxLength) {
          logger.error('Generated context exceeds limit', {
            length: updatedContext.length,
            maxLength,
          });
          return {
            success: false,
            error: `Generated context exceeds ${maxLength} character limit (${updatedContext.length} chars)`,
          };
        }

        // Save updated context
        await updateContextInDB(workspaceId, session.user.id, updatedContext);

        logger.info('Workspace context updated successfully', {
          workspaceId,
          updateReason,
          contextLength: updatedContext.length,
        });

        return {
          success: true,
          message: 'Workspace context updated successfully',
          updatedSections: [], // Handler doesn't provide structured sections
        };
      } catch (error) {
        logger.error('Error updating workspace context', {
          error,
          workspaceId,
          updateReason,
        });
        return {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : 'Unknown error updating context',
        };
      }
    },
  });
