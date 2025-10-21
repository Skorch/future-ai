'use server';

import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { revalidateTag } from 'next/cache';
import {
  updateArtifactType,
  createArtifactType,
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
  category: 'objective' | 'summary' | 'objectiveActions' | 'context';
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
