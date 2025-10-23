import { tool } from 'ai';
import { z } from 'zod';
import { getLogger } from '@/lib/logger';
import { getCategoryHandler } from '@/lib/artifacts/category-handlers';
import { getObjectiveById } from '@/lib/db/objective';
import {
  getCurrentVersionGoal,
  updateObjectiveGoal as updateGoalInDB,
} from '@/lib/db/objective-document';

const logger = getLogger('UpdateObjectiveGoal');

interface UpdateObjectiveGoalParams {
  session: { user: { id: string } };
  objectiveId: string;
  workspaceId: string;
}

/**
 * AI tool for updating objective goal definition
 * AGGRESSIVE capture - focus on THIS specific goal/deal/project
 */
export const updateObjectiveGoal = ({
  session,
  objectiveId,
  workspaceId,
}: UpdateObjectiveGoalParams) =>
  tool({
    description: `Update the objective goal definition with facts about THIS SPECIFIC goal, deal, or project.

BE AGGRESSIVE - capture everything relevant to THIS objective:
- Any stakeholder mentioned
- Requirements, constraints, or criteria
- Timeline, dates, or deadlines
- Progress updates or status changes
- Decisions made or options considered
- Budget or pricing discussions
- Technical details or specifications
- Risks, issues, or blockers
- Next steps or action items

OBJECTIVE GOAL (aggressive) vs WORKSPACE CONTEXT (conservative):
- Workspace = HOW the organization works (processes, methodologies)
- Objective = WHAT we're working on right now (this specific goal)

Examples:
✅ "Jane Smith is the champion at Acme Corp for this deal"
✅ "Budget is $500K, needs CFO approval"
✅ "Q2 decision timeline driven by fiscal year deadline"
✅ "Technical requirement: Must integrate with SAP"
❌ "We use MEDDIC sales methodology" (workspace context)
❌ "Our standard approval process requires VP sign-off" (workspace context)`,

    inputSchema: z.object({
      observations: z
        .array(z.string())
        .min(1)
        .describe(
          'Facts about THIS objective. Include stakeholders, requirements, timeline, progress, decisions, or any details specific to this goal.',
        ),
      updateReason: z
        .enum([
          'stakeholder_identified',
          'requirement_captured',
          'timeline_updated',
          'progress_reported',
          'decision_made',
          'blocker_identified',
          'status_changed',
          'context_enriched',
          'initial_setup',
        ])
        .describe('Category for this update.'),
    }),

    execute: async ({ observations, updateReason }) => {
      logger.debug('Tool called: updateObjectiveGoal', {
        objectiveId,
        workspaceId,
        updateReason,
        observationCount: observations.length,
      });

      try {
        // Get objective to verify ownership and get artifact type
        const objective = await getObjectiveById(objectiveId, session.user.id);
        if (!objective) {
          logger.error('Objective not found', {
            objectiveId,
            userId: session.user.id,
          });
          return {
            success: false,
            error: 'Objective not found',
          };
        }

        // Get category handler for objective context
        const { handler, artifactType } = await getCategoryHandler(
          objective.objectiveContextArtifactTypeId,
        );

        // Get current goal content
        const versionData = await getCurrentVersionGoal(
          objectiveId,
          session.user.id,
        );
        const currentGoal = versionData?.goal || undefined;

        // Build instruction from observations and update reason
        const instruction = `Update Reason: ${updateReason}

Observations:
${observations.map((obs, i) => `${i + 1}. ${obs}`).join('\n')}

## Task

Update the objective goal by incorporating these new observations. Focus on THIS specific objective.`;

        // Generate using category handler
        const updatedGoal = await handler.generate(artifactType, {
          currentVersion: currentGoal,
          instruction,
          workspaceId,
          objectiveId,
          session,
        });

        // Save the updated goal
        if (versionData) {
          await updateGoalInDB(
            versionData.versionId,
            session.user.id,
            updatedGoal,
          );
        } else {
          logger.warn('No version found for objective goal', { objectiveId });
          return {
            success: false,
            error: 'No version found for objective',
          };
        }

        logger.info('Objective goal updated successfully', {
          objectiveId,
          updateReason,
          goalLength: updatedGoal.length,
        });

        return {
          success: true,
          message: 'Objective context updated successfully',
          updatedSections: [], // Handler doesn't provide structured sections
        };
      } catch (error) {
        logger.error('Error updating objective goal', {
          error,
          objectiveId,
          updateReason,
        });
        return {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : 'Unknown error updating goal',
        };
      }
    },
  });
