import 'server-only';

import { unstable_cache } from 'next/cache';
import { db } from '@/lib/db/queries';
import { artifactType, type ArtifactType } from '../schema';
import { eq } from 'drizzle-orm';
import { getObjectiveById } from '../objective';

// Cache tag for invalidation
const CACHE_TAG = 'artifact-types';

/**
 * Fetch all artifact types (cached)
 * NOTE: Cache key includes version to allow cache busting after schema migrations
 */
export const getAllArtifactTypes = unstable_cache(
  async (): Promise<ArtifactType[]> => {
    return await db
      .select()
      .from(artifactType)
      .orderBy(artifactType.category, artifactType.title);
  },
  ['all-artifact-types-v2'],
  {
    tags: [CACHE_TAG],
    revalidate: false, // Cache until explicitly invalidated
  },
);

/**
 * Fetch single artifact type by ID (cached per ID)
 */
export const getArtifactTypeById = (id: string) =>
  unstable_cache(
    async (): Promise<ArtifactType | null> => {
      const [result] = await db
        .select()
        .from(artifactType)
        .where(eq(artifactType.id, id))
        .limit(1);

      return result || null;
    },
    [`artifact-type-${id}`],
    {
      tags: [CACHE_TAG, `artifact-type-${id}`],
      revalidate: false,
    },
  )();

/**
 * Fetch artifact types by category (leverages cache, filtered in-memory)
 */
export async function getArtifactTypesByCategory(
  category: 'objective' | 'summary' | 'objectiveActions' | 'context',
): Promise<ArtifactType[]> {
  const all = await getAllArtifactTypes();
  return all.filter((at) => at.category === category);
}

/**
 * Fetch artifact type by label (leverages cache, filtered in-memory)
 */
export async function getArtifactTypeByLabel(
  label: string,
): Promise<ArtifactType | null> {
  const all = await getAllArtifactTypes();
  return all.find((at) => at.label === label) || null;
}

/**
 * Fetch all 4 artifact types for an objective (document, actions, summary, context)
 */
export async function getArtifactTypesForObjective(
  objectiveId: string,
  userId: string,
): Promise<{
  document: ArtifactType | null;
  actions: ArtifactType | null;
  summary: ArtifactType | null;
  context: ArtifactType | null;
}> {
  const objective = await getObjectiveById(objectiveId, userId);

  if (!objective) {
    return {
      document: null,
      actions: null,
      summary: null,
      context: null,
    };
  }

  // Query all 4 artifact types in parallel
  const [document, actions, summary, context] = await Promise.all([
    objective.objectiveDocumentArtifactTypeId
      ? getArtifactTypeById(objective.objectiveDocumentArtifactTypeId)
      : Promise.resolve(null),
    objective.objectiveActionsArtifactTypeId
      ? getArtifactTypeById(objective.objectiveActionsArtifactTypeId)
      : Promise.resolve(null),
    objective.summaryArtifactTypeId
      ? getArtifactTypeById(objective.summaryArtifactTypeId)
      : Promise.resolve(null),
    objective.objectiveContextArtifactTypeId
      ? getArtifactTypeById(objective.objectiveContextArtifactTypeId)
      : Promise.resolve(null),
  ]);

  return {
    document,
    actions,
    summary,
    context,
  };
}
