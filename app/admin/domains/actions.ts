'use server';

import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { revalidateTag } from 'next/cache';
import {
  updateDomain,
  createDomain,
  cloneDomain,
  deleteDomain,
  setDefaultDomain,
  getWorkspaceCountByDomain,
  getDefaultDomain,
  reassignWorkspaces,
  getDomainWithRelations,
} from '@/lib/db/queries/admin/domain';
import { getLogger } from '@/lib/logger';
import { db } from '@/lib/db/queries';
import { playbookDomain } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

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
    defaultWorkspaceContext?: string;
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
  defaultWorkspaceContext?: string;
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

/**
 * Server action to clone a domain with all artifact types
 * Creates a complete copy of a domain with custom artifact type names
 */
export async function cloneDomainAction(
  domainId: string,
  newName: string,
  artifactTypeNames: Record<string, string>,
): Promise<{ success: true; domainId: string }> {
  const logger = getLogger('AdminDomains');

  // Check auth
  const { userId } = await auth();
  if (!userId) {
    redirect('/login');
  }

  try {
    // Verify source domain exists
    const sourceDomain = await getDomainWithRelations(domainId);
    if (!sourceDomain) {
      throw new Error(`Domain ${domainId} not found`);
    }

    // Clone domain with all artifact types
    const newDomain = await cloneDomain(
      domainId,
      newName,
      artifactTypeNames,
      userId,
    );

    // Invalidate caches
    revalidateTag('domains');

    logger.info(`Domain ${domainId} cloned to ${newDomain.id} by ${userId}`, {
      sourceDomainId: domainId,
      newDomainId: newDomain.id,
      newDomainName: newName,
    });

    return { success: true, domainId: newDomain.id };
  } catch (error) {
    logger.error('Failed to clone domain', { domainId, newName, error });
    throw error;
  }
}

/**
 * Server action to delete a domain
 * Handles workspace reassignment if needed
 */
export async function deleteDomainAction(
  domainId: string,
  reassignToDefault = false,
): Promise<{ success: true }> {
  const logger = getLogger('AdminDomains');

  // Check auth
  const { userId } = await auth();
  if (!userId) {
    redirect('/login');
  }

  try {
    // Check if domain exists
    const domainToDelete = await getDomainWithRelations(domainId);
    if (!domainToDelete) {
      throw new Error(`Domain ${domainId} not found`);
    }

    // Check if domain is default
    if (domainToDelete.isDefault) {
      throw new Error('Cannot delete the default domain');
    }

    // Count workspaces using this domain
    const workspaceCount = await getWorkspaceCountByDomain(domainId);

    if (workspaceCount > 0) {
      if (!reassignToDefault) {
        throw new Error(
          `Cannot delete domain with ${workspaceCount} workspace(s). Set reassignToDefault=true to reassign them.`,
        );
      }

      // Get default domain for reassignment
      const defaultDomain = await getDefaultDomain();
      if (!defaultDomain) {
        throw new Error('No default domain found for workspace reassignment');
      }

      // Reassign workspaces to default domain
      await reassignWorkspaces(domainId, defaultDomain.id);
      logger.info(
        `Reassigned ${workspaceCount} workspace(s) from domain ${domainId} to default domain ${defaultDomain.id}`,
      );
    }

    // Delete playbookDomain junction records
    await db
      .delete(playbookDomain)
      .where(eq(playbookDomain.domainId, domainId));

    // Delete domain
    await deleteDomain(domainId);

    // Invalidate caches
    revalidateTag('domains');
    revalidateTag(`domain-${domainId}`);

    logger.info(`Domain ${domainId} deleted by ${userId}`, {
      workspacesReassigned: workspaceCount,
    });

    return { success: true };
  } catch (error) {
    logger.error('Failed to delete domain', { domainId, error });
    throw error;
  }
}

/**
 * Server action to set a domain as default
 * Clears default flag on all other domains
 */
export async function setDefaultDomainAction(
  domainId: string,
): Promise<{ success: true }> {
  const logger = getLogger('AdminDomains');

  // Check auth
  const { userId } = await auth();
  if (!userId) {
    redirect('/login');
  }

  try {
    // Verify domain exists
    const domainToSetDefault = await getDomainWithRelations(domainId);
    if (!domainToSetDefault) {
      throw new Error(`Domain ${domainId} not found`);
    }

    // Set as default (transaction handles clearing others)
    await setDefaultDomain(domainId);

    // Invalidate caches
    revalidateTag('domains');
    revalidateTag(`domain-${domainId}`);

    logger.info(`Domain ${domainId} set as default by ${userId}`);

    return { success: true };
  } catch (error) {
    logger.error('Failed to set default domain', { domainId, error });
    throw error;
  }
}
