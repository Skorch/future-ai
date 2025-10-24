'use server';

import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { revalidateTag } from 'next/cache';
import {
  updateArtifactType,
  createArtifactType,
  cloneArtifactType,
  deleteArtifactType,
  getArtifactTypeUsageCount,
} from '@/lib/db/queries/admin/artifact-type';
import { getLogger } from '@/lib/logger';

/**
 * Server action to update an artifact type
 * Updates artifact type configuration and invalidates relevant caches
 */
export async function updateArtifactTypeAction(
  artifactTypeId: string,
  data: {
    label?: string;
    title?: string;
    description?: string;
    instructionPrompt?: string;
    template?: string;
  },
) {
  // 1. Get logger
  const logger = getLogger('AdminArtifactTypes');

  // 2. Check auth
  const { userId } = await auth();
  if (!userId) {
    redirect('/login');
  }

  // 3. Call DAL function
  try {
    await updateArtifactType(artifactTypeId, data, userId);

    // 4. Invalidate caches
    revalidateTag('artifact-types');
    revalidateTag(`artifact-type-${artifactTypeId}`);
    revalidateTag('domains'); // Domains reference artifact types

    logger.info(`Artifact type ${artifactTypeId} updated by ${userId}`);
  } catch (error) {
    logger.error('Failed to update artifact type', { artifactTypeId, error });
    throw error;
  }
}

/**
 * Server action to create a new artifact type
 * Creates artifact type with configuration and invalidates relevant caches
 */
export async function createArtifactTypeAction(data: {
  category:
    | 'objective'
    | 'summary'
    | 'objectiveActions'
    | 'workspaceContext'
    | 'objectiveContext';
  label: string;
  title: string;
  description: string;
  instructionPrompt: string;
  template?: string;
}) {
  const logger = getLogger('AdminArtifactTypes');

  // Check auth
  const { userId } = await auth();
  if (!userId) {
    redirect('/login');
  }

  // Call DAL function
  try {
    const newArtifactType = await createArtifactType(data, userId);

    // Invalidate caches
    revalidateTag('artifact-types');
    revalidateTag('domains'); // Domains list artifact types

    logger.info(`Artifact type ${newArtifactType.id} created by ${userId}`);

    return { success: true, artifactTypeId: newArtifactType.id };
  } catch (error) {
    logger.error('Failed to create artifact type', { error });
    throw error;
  }
}

/**
 * Server action to clone an artifact type
 * Creates a copy with optional new name, invalidates relevant caches
 */
export async function cloneArtifactTypeAction(
  artifactTypeId: string,
  newName?: string,
): Promise<{ success: true; artifactTypeId: string }> {
  const logger = getLogger('AdminArtifactTypes');

  // Check auth
  const { userId } = await auth();
  if (!userId) {
    redirect('/login');
  }

  // Call DAL function
  try {
    const cloned = await cloneArtifactType(
      artifactTypeId,
      newName || '',
      userId,
    );

    // Caches already invalidated in DAL function
    logger.info(
      `Artifact type ${artifactTypeId} cloned to ${cloned.id} by ${userId}`,
    );

    return { success: true, artifactTypeId: cloned.id };
  } catch (error) {
    logger.error('Failed to clone artifact type', { artifactTypeId, error });
    throw error;
  }
}

/**
 * Server action to delete an artifact type
 * Checks usage before deletion and throws error if type is in use
 */
export async function deleteArtifactTypeAction(
  artifactTypeId: string,
): Promise<{ success: true }> {
  const logger = getLogger('AdminArtifactTypes');

  // Check auth
  const { userId } = await auth();
  if (!userId) {
    redirect('/login');
  }

  try {
    // Check usage count
    const usage = await getArtifactTypeUsageCount(artifactTypeId);

    if (usage.total > 0) {
      const details = [];
      if (usage.domainCount > 0) details.push(`${usage.domainCount} domain(s)`);
      if (usage.workspaceCount > 0)
        details.push(`${usage.workspaceCount} workspace(s)`);
      if (usage.objectiveCount > 0)
        details.push(`${usage.objectiveCount} objective(s)`);

      throw new Error(
        `Cannot delete artifact type: currently used by ${details.join(', ')}. Remove all references before deleting.`,
      );
    }

    // Delete artifact type
    await deleteArtifactType(artifactTypeId);

    // Caches already invalidated in DAL function
    logger.info(`Artifact type ${artifactTypeId} deleted by ${userId}`);

    return { success: true };
  } catch (error) {
    logger.error('Failed to delete artifact type', { artifactTypeId, error });
    throw error;
  }
}
