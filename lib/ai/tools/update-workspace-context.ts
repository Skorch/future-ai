import { tool } from 'ai';
import { z } from 'zod';
import { getLogger } from '@/lib/logger';

const logger = getLogger('UpdateWorkspaceContext');

interface UpdateWorkspaceContextParams {
  session: { user: { id: string } };
  workspaceId: string;
}

/**
 * AI tool for updating workspace context
 * Thin wrapper around the POST /api/workspace/[workspaceId]/context endpoint
 */
export const updateWorkspaceContext = ({
  session,
  workspaceId,
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
      const startTime = Date.now();

      try {
        logger.debug('Updating workspace context', {
          workspaceId,
          updateReason,
          observationCount: observations.length,
        });

        // Call the API route
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/workspace/${workspaceId}/context`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              // Pass user ID for auth (this runs server-side, so we need to handle auth)
              'x-user-id': session.user.id,
            },
            body: JSON.stringify({
              observations,
              updateReason,
            }),
          },
        );

        if (!response.ok) {
          const error = await response.json();
          logger.error('Failed to update workspace context', {
            status: response.status,
            error,
          });
          return {
            success: false,
            error: error.error || 'Failed to update context',
          };
        }

        const result = await response.json();

        logger.info('Workspace context updated successfully', {
          workspaceId,
          updateReason,
          updatedSections: result.updatedSections,
          duration: Date.now() - startTime,
        });

        return {
          success: true,
          message: 'Workspace context updated successfully',
          updatedSections: result.updatedSections,
        };
      } catch (error) {
        logger.error('Error updating workspace context', {
          error,
          workspaceId,
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
