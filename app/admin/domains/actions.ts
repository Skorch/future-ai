'use server';

import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { revalidateTag } from 'next/cache';
import { updateDomain, createDomain } from '@/lib/db/queries/admin/domain';
import { getLogger } from '@/lib/logger';

/**
 * Server action to update a domain
 * Updates domain configuration and invalidates relevant caches
 */
export async function updateDomainAction(
  domainId: string,
  data: {
    title?: string;
    description?: string;
    systemPrompt?: string;
    defaultObjectiveArtifactTypeId?: string;
    defaultSummaryArtifactTypeId?: string;
    defaultObjectiveActionsArtifactTypeId?: string;
    defaultWorkspaceContextArtifactTypeId?: string;
    defaultObjectiveContextArtifactTypeId?: string;
  },
) {
  // 1. Get logger
  const logger = getLogger('AdminDomains');

  // 2. Check auth
  const { userId } = await auth();
  if (!userId) {
    redirect('/login');
  }

  // 3. Call DAL function
  try {
    await updateDomain(domainId, data, userId);

    // 4. Invalidate caches
    revalidateTag('domains');
    revalidateTag(`domain-${domainId}`);

    logger.info(`Domain ${domainId} updated by ${userId}`);
  } catch (error) {
    logger.error('Failed to update domain', { domainId, error });
    throw error;
  }
}

/**
 * Server action to create a new domain
 * Creates domain with configuration and invalidates relevant caches
 */
export async function createDomainAction(data: {
  title: string;
  description: string;
  systemPrompt: string;
  defaultObjectiveArtifactTypeId: string;
  defaultSummaryArtifactTypeId: string;
  defaultObjectiveActionsArtifactTypeId: string;
  defaultWorkspaceContextArtifactTypeId: string;
  defaultObjectiveContextArtifactTypeId: string;
}) {
  const logger = getLogger('AdminDomains');

  // Check auth
  const { userId } = await auth();
  if (!userId) {
    redirect('/login');
  }

  // Call DAL function
  try {
    const newDomain = await createDomain(data, userId);

    // Invalidate caches
    revalidateTag('domains');

    logger.info(`Domain ${newDomain.id} created by ${userId}`);

    return { success: true, domainId: newDomain.id };
  } catch (error) {
    logger.error('Failed to create domain', { error });
    throw error;
  }
}
