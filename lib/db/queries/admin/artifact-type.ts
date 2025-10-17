import 'server-only';

import { revalidateTag } from 'next/cache';
import { db } from '@/lib/db/queries';
import { artifactType, type ArtifactType } from '../../schema';
import { eq } from 'drizzle-orm';

/**
 * Admin mutations for ArtifactType table
 * These operations invalidate user-facing caches
 */

/**
 * Update an artifact type (admin only)
 * Invalidates both artifact-type and domain caches
 */
export async function updateArtifactType(
  id: string,
  data: {
    title?: string;
    description?: string;
    instructionPrompt?: string;
    template?: string;
  },
  userId: string,
): Promise<ArtifactType | null> {
  // Validate required fields if being updated
  if (data.instructionPrompt !== undefined && !data.instructionPrompt.trim()) {
    throw new Error('instructionPrompt cannot be empty');
  }

  const [updated] = await db
    .update(artifactType)
    .set({
      ...(data.title && { title: data.title }),
      ...(data.description && { description: data.description }),
      ...(data.instructionPrompt !== undefined && {
        instructionPrompt: data.instructionPrompt,
      }),
      ...(data.template !== undefined && { template: data.template }),
      updatedByUserId: userId,
      updatedAt: new Date(),
    })
    .where(eq(artifactType.id, id))
    .returning();

  if (!updated) return null;

  // Invalidate caches
  revalidateTag('artifact-types');
  revalidateTag(`artifact-type-${id}`);
  revalidateTag('domains'); // Domain includes artifact type relations

  return updated;
}
