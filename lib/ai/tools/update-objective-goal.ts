import { tool } from 'ai';
import { z } from 'zod';
import { getLogger } from '@/lib/logger';
import { generateObjectiveGoal } from '@/lib/objective/objective-goal';

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

      const result = await generateObjectiveGoal({
        objectiveId,
        workspaceId,
        userId: session.user.id,
        observations,
        updateReason,
      });

      if (result.success) {
        return {
          success: true,
          message: 'Objective context updated successfully',
          updatedSections: result.updatedSections || [],
        };
      }

      return {
        success: false,
        error: result.error || 'Failed to update context',
      };
    },
  });
