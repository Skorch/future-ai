'use server';

import { revalidatePath } from 'next/cache';
import { getLogger } from '@/lib/logger';
import { withAuth, type ActionResult } from '@/lib/with-auth';
import {
  createObjective,
  deleteObjective,
  updateObjective,
  publishObjective,
  unpublishObjective,
  getObjectiveById,
} from '@/lib/db/objective';
import { auth } from '@clerk/nextjs/server';
import {
  getCurrentVersionGoal,
  updateObjectiveGoal,
} from '@/lib/db/objective-document';

const logger = getLogger('ObjectiveActions');

/**
 * Server action to create a new objective
 */
export const createObjectiveAction = withAuth<
  [string, { title: string; description?: string; documentType?: string }],
  { id: string }
>(
  'createObjective',
  async (
    userId: string,
    workspaceId: string,
    data: { title: string; description?: string; documentType?: string },
  ): Promise<ActionResult<{ id: string }>> => {
    logger.debug('Creating objective', { workspaceId, title: data.title });

    try {
      const objective = await createObjective(workspaceId, userId, data);

      // Revalidate Next.js cache
      revalidatePath(`/workspace/${workspaceId}`);

      logger.info('Objective created', {
        objectiveId: objective.id,
        workspaceId,
      });

      return {
        success: true,
        data: { id: objective.id },
        revalidate: {
          paths: [`/workspace/${workspaceId}`],
          swrKeys: [`/api/workspace/${workspaceId}/objectives`],
        },
      };
    } catch (error) {
      logger.error('Failed to create objective', {
        workspaceId,
        error,
      });
      throw error; // Let withAuth handle error response
    }
  },
);

/**
 * Server action to delete an objective
 */
export const deleteObjectiveAction = withAuth(
  'deleteObjective',
  async (userId: string, objectiveId: string): Promise<ActionResult> => {
    logger.debug('Deleting objective', { objectiveId });

    try {
      // Get objective first to know workspaceId for revalidation
      const objective = await getObjectiveById(objectiveId, userId);

      if (!objective) {
        logger.warn('Objective not found for deletion', {
          objectiveId,
          userId,
        });
        return {
          success: false,
          error: 'Objective not found',
        };
      }

      await deleteObjective(objectiveId, userId);

      // Revalidate with actual workspaceId
      revalidatePath(`/workspace/${objective.workspaceId}`);

      logger.info('Objective deleted (cascade to chats)', {
        objectiveId,
        workspaceId: objective.workspaceId,
      });

      return {
        success: true,
        revalidate: {
          paths: [`/workspace/${objective.workspaceId}`],
          swrKeys: [`/api/workspace/${objective.workspaceId}/objectives`],
        },
      };
    } catch (error) {
      logger.error('Delete objective failed', {
        objectiveId,
        error,
      });
      throw error; // Let withAuth handle error response
    }
  },
);

/**
 * Server action to update an objective
 */
export const updateObjectiveAction = withAuth(
  'updateObjective',
  async (
    userId: string,
    objectiveId: string,
    data: { title?: string; description?: string; documentType?: string },
  ): Promise<ActionResult> => {
    logger.debug('Updating objective', { objectiveId, data });

    try {
      const objective = await getObjectiveById(objectiveId, userId);

      if (!objective) {
        logger.warn('Objective not found for update', {
          objectiveId,
          userId,
        });
        return {
          success: false,
          error: 'Objective not found',
        };
      }

      await updateObjective(objectiveId, userId, data);

      // Revalidate paths
      revalidatePath(`/workspace/${objective.workspaceId}`);
      revalidatePath(
        `/workspace/${objective.workspaceId}/objective/${objectiveId}`,
      );

      logger.info('Objective updated', {
        objectiveId,
        workspaceId: objective.workspaceId,
      });

      return {
        success: true,
        revalidate: {
          paths: [
            `/workspace/${objective.workspaceId}`,
            `/workspace/${objective.workspaceId}/objective/${objectiveId}`,
          ],
          swrKeys: [`/api/workspace/${objective.workspaceId}/objectives`],
        },
      };
    } catch (error) {
      logger.error('Update objective failed', {
        objectiveId,
        error,
      });
      throw error; // Let withAuth handle error response
    }
  },
);

/**
 * Server action to publish an objective
 */
export const publishObjectiveAction = withAuth(
  'publishObjective',
  async (userId: string, objectiveId: string): Promise<ActionResult> => {
    logger.debug('Publishing objective', { objectiveId });

    try {
      const objective = await getObjectiveById(objectiveId, userId);

      if (!objective) {
        logger.warn('Objective not found for publishing', {
          objectiveId,
          userId,
        });
        return {
          success: false,
          error: 'Objective not found',
        };
      }

      await publishObjective(objectiveId, userId);

      // Revalidate paths
      revalidatePath(`/workspace/${objective.workspaceId}`);
      revalidatePath(
        `/workspace/${objective.workspaceId}/objective/${objectiveId}`,
      );

      logger.info('Objective published', {
        objectiveId,
        workspaceId: objective.workspaceId,
      });

      return {
        success: true,
        revalidate: {
          paths: [
            `/workspace/${objective.workspaceId}`,
            `/workspace/${objective.workspaceId}/objective/${objectiveId}`,
          ],
          swrKeys: [`/api/workspace/${objective.workspaceId}/objectives`],
        },
      };
    } catch (error) {
      logger.error('Publish objective failed', {
        objectiveId,
        error,
      });
      throw error; // Let withAuth handle error response
    }
  },
);

/**
 * Server action to unpublish an objective
 */
export const unpublishObjectiveAction = withAuth(
  'unpublishObjective',
  async (userId: string, objectiveId: string): Promise<ActionResult> => {
    logger.debug('Unpublishing objective', { objectiveId });

    try {
      const objective = await getObjectiveById(objectiveId, userId);

      if (!objective) {
        logger.warn('Objective not found for unpublishing', {
          objectiveId,
          userId,
        });
        return {
          success: false,
          error: 'Objective not found',
        };
      }

      await unpublishObjective(objectiveId, userId);

      // Revalidate paths
      revalidatePath(`/workspace/${objective.workspaceId}`);
      revalidatePath(
        `/workspace/${objective.workspaceId}/objective/${objectiveId}`,
      );

      logger.info('Objective unpublished', {
        objectiveId,
        workspaceId: objective.workspaceId,
      });

      return {
        success: true,
        revalidate: {
          paths: [
            `/workspace/${objective.workspaceId}`,
            `/workspace/${objective.workspaceId}/objective/${objectiveId}`,
          ],
          swrKeys: [`/api/workspace/${objective.workspaceId}/objectives`],
        },
      };
    } catch (error) {
      logger.error('Unpublish objective failed', {
        objectiveId,
        error,
      });
      throw error; // Let withAuth handle error response
    }
  },
);

/**
 * Server action to update objective goal
 */
export async function updateObjectiveGoalAction(
  objectiveId: string,
  goal: string,
): Promise<void> {
  const session = await auth();
  if (!session?.userId) {
    throw new Error('Unauthorized');
  }

  // Validate length
  if (goal && goal.length > 5000) {
    throw new Error('Goal exceeds 5000 characters');
  }

  // Get current version
  const versionData = await getCurrentVersionGoal(objectiveId, session.userId);
  if (!versionData) {
    throw new Error('No version found for objective');
  }

  // Update goal in current version
  await updateObjectiveGoal(versionData.versionId, session.userId, goal);

  // Get objective to find workspaceId for revalidation
  const objective = await getObjectiveById(objectiveId, session.userId);
  if (objective) {
    revalidatePath(
      `/workspace/${objective.workspaceId}/objective/${objectiveId}`,
    );
  }
}

/**
 * Server action to toggle objective publish status
 */
export async function toggleObjectivePublishAction(
  objectiveId: string,
  published: boolean,
): Promise<ActionResult> {
  const logger = getLogger('ObjectiveActions');

  logger.debug('Toggling objective publish status', {
    objectiveId,
    published,
  });

  if (published) {
    return publishObjectiveAction(objectiveId);
  } else {
    return unpublishObjectiveAction(objectiveId);
  }
}
