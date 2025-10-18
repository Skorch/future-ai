'use server';

import { auth } from '@clerk/nextjs/server';
import { revalidateTag } from 'next/cache';
import { redirect } from 'next/navigation';
import { updateDomain } from '@/lib/db/queries/admin/domain';
import { updateArtifactType } from '@/lib/db/queries/admin/artifact-type';
import { getLogger } from '@/lib/logger';

const logger = getLogger('AdminPrompts');

/**
 * Update domain system prompt
 */
export async function updateDomainPrompt(
  domainId: string,
  systemPrompt: string,
) {
  const { userId } = await auth();

  if (!userId) {
    logger.warn('Unauthorized domain prompt update attempt');
    redirect('/login');
  }

  try {
    logger.info('Updating domain prompt', { domainId, userId });

    await updateDomain(domainId, { systemPrompt }, userId);

    // Cache invalidation is handled by admin DAL, but revalidate explicitly for safety
    revalidateTag('domains');
    revalidateTag(`domain-${domainId}`);

    logger.info('Domain prompt updated successfully', { domainId });
  } catch (error) {
    logger.error('Failed to update domain prompt', { domainId, error });
    throw error;
  }
}

/**
 * Update artifact type instruction prompt or template
 */
export async function updateArtifactTypePrompt(
  artifactTypeId: string,
  data: { instructionPrompt?: string; template?: string },
) {
  const { userId } = await auth();

  if (!userId) {
    logger.warn('Unauthorized artifact type prompt update attempt');
    redirect('/login');
  }

  try {
    logger.info('Updating artifact type prompt', {
      artifactTypeId,
      userId,
      fields: Object.keys(data),
    });

    await updateArtifactType(artifactTypeId, data, userId);

    // Cache invalidation is handled by admin DAL, but revalidate explicitly for safety
    revalidateTag('artifact-types');
    revalidateTag(`artifact-type-${artifactTypeId}`);
    revalidateTag('domains'); // Domains have nested artifact type relations

    logger.info('Artifact type prompt updated successfully', {
      artifactTypeId,
    });
  } catch (error) {
    logger.error('Failed to update artifact type prompt', {
      artifactTypeId,
      error,
    });
    throw error;
  }
}
