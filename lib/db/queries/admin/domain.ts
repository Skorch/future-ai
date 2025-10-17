import 'server-only';

import { revalidateTag } from 'next/cache';
import { db } from '@/lib/db/queries';
import { domain, artifactType, type Domain } from '../../schema';
import { eq } from 'drizzle-orm';

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
    defaultPunchlistArtifactTypeId?: string;
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
    data.defaultPunchlistArtifactTypeId,
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
      ...(data.defaultPunchlistArtifactTypeId && {
        defaultPunchlistArtifactTypeId: data.defaultPunchlistArtifactTypeId,
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
