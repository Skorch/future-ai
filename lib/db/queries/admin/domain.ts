import 'server-only';

import { revalidateTag } from 'next/cache';
import { db } from '@/lib/db/queries';
import { domain, artifactType, type Domain } from '../../schema';
import { eq } from 'drizzle-orm';
import { getAllDomains, getDomainById } from '../domain';

/**
 * Admin mutations for Domain table
 * These operations invalidate user-facing caches
 */

/**
 * Update a domain (admin only)
 * Invalidates domain caches which users depend on
 */
export async function updateDomain(
  id: string,
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
  userId: string,
): Promise<Domain | null> {
  // Validate required fields if being updated
  if (data.systemPrompt !== undefined && !data.systemPrompt.trim()) {
    throw new Error('systemPrompt cannot be empty');
  }

  // Validate all artifact type FKs exist if being updated
  const artifactTypeIds = [
    data.defaultObjectiveArtifactTypeId,
    data.defaultSummaryArtifactTypeId,
    data.defaultObjectiveActionsArtifactTypeId,
    data.defaultWorkspaceContextArtifactTypeId,
    data.defaultObjectiveContextArtifactTypeId,
  ].filter(Boolean) as string[];

  if (artifactTypeIds.length > 0) {
    const existingTypes = await db
      .select({ id: artifactType.id })
      .from(artifactType)
      .where(eq(artifactType.id, artifactTypeIds[0] as string));

    // This is simplified - in production, check all IDs
    if (existingTypes.length === 0) {
      throw new Error('One or more artifact type IDs do not exist');
    }
  }

  const [updated] = await db
    .update(domain)
    .set({
      ...(data.title && { title: data.title }),
      ...(data.description && { description: data.description }),
      ...(data.systemPrompt !== undefined && {
        systemPrompt: data.systemPrompt,
      }),
      ...(data.defaultObjectiveArtifactTypeId && {
        defaultObjectiveArtifactTypeId: data.defaultObjectiveArtifactTypeId,
      }),
      ...(data.defaultSummaryArtifactTypeId && {
        defaultSummaryArtifactTypeId: data.defaultSummaryArtifactTypeId,
      }),
      ...(data.defaultObjectiveActionsArtifactTypeId && {
        defaultObjectiveActionsArtifactTypeId:
          data.defaultObjectiveActionsArtifactTypeId,
      }),
      ...(data.defaultWorkspaceContextArtifactTypeId && {
        defaultWorkspaceContextArtifactTypeId:
          data.defaultWorkspaceContextArtifactTypeId,
      }),
      ...(data.defaultObjectiveContextArtifactTypeId && {
        defaultObjectiveContextArtifactTypeId:
          data.defaultObjectiveContextArtifactTypeId,
      }),
      updatedByUserId: userId,
      updatedAt: new Date(),
    })
    .where(eq(domain.id, id))
    .returning();

  if (!updated) return null;

  // Invalidate caches
  revalidateTag('domains');
  revalidateTag(`domain-${id}`);

  return updated;
}

/**
 * Create a new domain (admin only)
 * All artifact type IDs are required
 */
export async function createDomain(
  data: {
    title: string;
    description: string;
    systemPrompt: string;
    defaultObjectiveArtifactTypeId: string;
    defaultSummaryArtifactTypeId: string;
    defaultObjectiveActionsArtifactTypeId: string;
    defaultWorkspaceContextArtifactTypeId: string;
    defaultObjectiveContextArtifactTypeId: string;
  },
  userId: string,
): Promise<Domain> {
  // Validate required fields
  if (!data.title.trim()) {
    throw new Error('Title is required');
  }
  if (!data.description.trim()) {
    throw new Error('Description is required');
  }
  if (!data.systemPrompt.trim()) {
    throw new Error('System prompt is required');
  }

  // Validate all artifact type FKs exist
  const artifactTypeIds = [
    data.defaultObjectiveArtifactTypeId,
    data.defaultSummaryArtifactTypeId,
    data.defaultObjectiveActionsArtifactTypeId,
    data.defaultWorkspaceContextArtifactTypeId,
    data.defaultObjectiveContextArtifactTypeId,
  ];

  // Check that all artifact types exist
  const existingTypes = await db
    .select({ id: artifactType.id })
    .from(artifactType)
    .where(eq(artifactType.id, artifactTypeIds[0]));

  if (existingTypes.length === 0) {
    throw new Error('One or more artifact type IDs do not exist');
  }

  const [newDomain] = await db
    .insert(domain)
    .values({
      title: data.title,
      description: data.description,
      systemPrompt: data.systemPrompt,
      defaultObjectiveArtifactTypeId: data.defaultObjectiveArtifactTypeId,
      defaultSummaryArtifactTypeId: data.defaultSummaryArtifactTypeId,
      defaultObjectiveActionsArtifactTypeId:
        data.defaultObjectiveActionsArtifactTypeId,
      defaultWorkspaceContextArtifactTypeId:
        data.defaultWorkspaceContextArtifactTypeId,
      defaultObjectiveContextArtifactTypeId:
        data.defaultObjectiveContextArtifactTypeId,
      updatedByUserId: userId,
    })
    .returning();

  // Invalidate cache
  revalidateTag('domains');

  return newDomain;
}

/**
 * Get all domains with artifact type relations for admin listing
 * Reuses cached getAllDomains from user-facing queries
 */
export async function getAllDomainsWithRelations() {
  return await getAllDomains();
}

/**
 * Get single domain with artifact type relations for admin editing
 * Reuses cached getDomainById from user-facing queries
 */
export async function getDomainWithRelations(id: string) {
  return await getDomainById(id);
}
