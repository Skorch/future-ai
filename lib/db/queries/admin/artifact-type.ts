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

/**
 * Get all artifact types for admin listing
 */
export async function getAllArtifactTypes(): Promise<ArtifactType[]> {
  return db.select().from(artifactType);
}

/**
 * Get single artifact type by ID
 */
export async function getArtifactTypeById(
  id: string,
): Promise<ArtifactType | null> {
  const [result] = await db
    .select()
    .from(artifactType)
    .where(eq(artifactType.id, id));
  return result || null;
}

/**
 * Check usage count (domains, workspaces, objectives using this type)
 * Returns count of each entity type that references this artifact type
 */
export async function getArtifactTypeUsageCount(id: string): Promise<{
  domainCount: number;
  workspaceCount: number;
  objectiveCount: number;
  total: number;
}> {
  const { domain, workspace, objective } = await import('../../schema');
  const { or } = await import('drizzle-orm');

  // Count domains using this artifact type (any of 5 FK columns)
  const domainResults = await db
    .select()
    .from(domain)
    .where(
      or(
        eq(domain.defaultObjectiveArtifactTypeId, id),
        eq(domain.defaultSummaryArtifactTypeId, id),
        eq(domain.defaultObjectiveActionsArtifactTypeId, id),
        eq(domain.defaultWorkspaceContextArtifactTypeId, id),
        eq(domain.defaultObjectiveContextArtifactTypeId, id),
      ),
    );

  // Count workspaces using this artifact type
  const workspaceResults = await db
    .select()
    .from(workspace)
    .where(eq(workspace.workspaceContextArtifactTypeId, id));

  // Count objectives using this artifact type (any of 4 FK columns)
  const objectiveResults = await db
    .select()
    .from(objective)
    .where(
      or(
        eq(objective.objectiveContextArtifactTypeId, id),
        eq(objective.objectiveDocumentArtifactTypeId, id),
        eq(objective.objectiveActionsArtifactTypeId, id),
        eq(objective.summaryArtifactTypeId, id),
      ),
    );

  const domainCount = domainResults.length;
  const workspaceCount = workspaceResults.length;
  const objectiveCount = objectiveResults.length;

  return {
    domainCount,
    workspaceCount,
    objectiveCount,
    total: domainCount + workspaceCount + objectiveCount,
  };
}

/**
 * Clone an artifact type
 * Creates a new artifact type with "Copy of {name}" prefix unless newName provided
 */
export async function cloneArtifactType(
  sourceId: string,
  newName: string,
  userId: string,
): Promise<ArtifactType> {
  // Load original artifact type
  const original = await getArtifactTypeById(sourceId);
  if (!original) {
    throw new Error(`Artifact type ${sourceId} not found`);
  }

  // Create clone with new name
  const clonedLabel = newName || `Copy of ${original.label}`;
  const clonedTitle = newName || `Copy of ${original.title}`;

  const [cloned] = await db
    .insert(artifactType)
    .values({
      category: original.category,
      label: clonedLabel,
      title: clonedTitle,
      description: original.description,
      instructionPrompt: original.instructionPrompt,
      template: original.template,
      updatedByUserId: userId,
    })
    .returning();

  if (!cloned) {
    throw new Error('Failed to clone artifact type');
  }

  // Invalidate caches
  revalidateTag('artifact-types');
  revalidateTag('domains');

  return cloned;
}

/**
 * Delete artifact type (assumes usage checks already done)
 * This will fail at database level if there are any references due to onDelete: 'restrict'
 */
export async function deleteArtifactType(id: string): Promise<void> {
  await db.delete(artifactType).where(eq(artifactType.id, id));

  // Invalidate caches
  revalidateTag('artifact-types');
  revalidateTag(`artifact-type-${id}`);
  revalidateTag('domains');
}
