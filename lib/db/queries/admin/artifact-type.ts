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
    label?: string;
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
  if (data.label !== undefined && !data.label.trim()) {
    throw new Error('label cannot be empty');
  }
  if (data.title !== undefined && !data.title.trim()) {
    throw new Error('title cannot be empty');
  }
  if (data.description !== undefined && !data.description.trim()) {
    throw new Error('description cannot be empty');
  }

  const [updated] = await db
    .update(artifactType)
    .set({
      ...(data.label !== undefined && { label: data.label }),
      ...(data.title !== undefined && { title: data.title }),
      ...(data.description !== undefined && { description: data.description }),
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

/**
 * Create a new artifact type (admin only)
 * Invalidates artifact-type and domain caches
 */
export async function createArtifactType(
  data: {
    category: 'objective' | 'summary' | 'objectiveActions' | 'context';
    label: string;
    title: string;
    description: string;
    instructionPrompt: string;
    template?: string;
  },
  userId: string,
): Promise<ArtifactType> {
  // Validate required fields
  if (!data.instructionPrompt.trim()) {
    throw new Error('instructionPrompt cannot be empty');
  }
  if (!data.label.trim()) {
    throw new Error('label cannot be empty');
  }
  if (!data.title.trim()) {
    throw new Error('title cannot be empty');
  }
  if (!data.description.trim()) {
    throw new Error('description cannot be empty');
  }

  const [newType] = await db
    .insert(artifactType)
    .values({
      category: data.category,
      label: data.label,
      title: data.title,
      description: data.description,
      instructionPrompt: data.instructionPrompt,
      template: data.template || null,
      updatedByUserId: userId,
    })
    .returning();

  if (!newType) {
    throw new Error('Failed to create artifact type');
  }

  // Invalidate caches
  revalidateTag('artifact-types');
  revalidateTag('domains'); // Domains include artifact type relations

  return newType;
}
