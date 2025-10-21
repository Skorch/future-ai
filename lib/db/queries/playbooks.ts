import 'server-only';

import { unstable_cache, revalidateTag } from 'next/cache';
import { db } from '@/lib/db/queries';
import {
  playbook,
  playbookStep,
  playbookDomain,
  type Playbook,
  type PlaybookWithSteps,
  type PlaybookMetadata,
} from '../schema';
import { eq, asc } from 'drizzle-orm';

// Cache tag for invalidation
const CACHE_TAG = 'playbooks';

// Fetch all playbooks with metadata (cached)
export const getAllPlaybooks = unstable_cache(
  async (): Promise<PlaybookMetadata[]> => {
    return await db
      .select({
        id: playbook.id,
        name: playbook.name,
        description: playbook.description,
        whenToUse: playbook.whenToUse,
      })
      .from(playbook)
      .orderBy(playbook.name);
  },
  ['all-playbooks'],
  {
    tags: [CACHE_TAG],
    revalidate: false, // Cache until explicitly invalidated
  },
);

// List playbooks (simple metadata only)
export async function listPlaybooks(): Promise<PlaybookMetadata[]> {
  return await getAllPlaybooks();
}

// Filter playbooks by domain (using junction table join)
export async function getPlaybooksForDomain(
  domainId: string,
): Promise<PlaybookMetadata[]> {
  return await db
    .select({
      id: playbook.id,
      name: playbook.name,
      description: playbook.description,
      whenToUse: playbook.whenToUse,
    })
    .from(playbook)
    .innerJoin(playbookDomain, eq(playbookDomain.playbookId, playbook.id))
    .where(eq(playbookDomain.domainId, domainId))
    .orderBy(playbook.name);
}

// Fetch single playbook with all steps (cached per playbook)
export const getPlaybookWithSteps = (id: string) =>
  unstable_cache(
    async (): Promise<PlaybookWithSteps | null> => {
      const [playbookData] = await db
        .select()
        .from(playbook)
        .where(eq(playbook.id, id))
        .limit(1);

      if (!playbookData) return null;

      const steps = await db
        .select()
        .from(playbookStep)
        .where(eq(playbookStep.playbookId, id))
        .orderBy(asc(playbookStep.sequence));

      return {
        ...playbookData,
        steps,
      };
    },
    [`playbook-${id}`],
    {
      tags: [CACHE_TAG, `playbook-${id}`],
      revalidate: false,
    },
  )();

// CRUD operations (admin only, invalidates cache)
export async function createPlaybook(data: {
  name: string;
  description?: string;
  whenToUse?: string;
  domainIds: string[]; // Now using domain UUIDs
  steps: { sequence: number; instruction: string }[];
}): Promise<Playbook> {
  const result = await db.transaction(async (tx) => {
    // Insert playbook
    const [newPlaybook] = await tx
      .insert(playbook)
      .values({
        name: data.name,
        description: data.description,
        whenToUse: data.whenToUse,
      })
      .returning();

    // Insert domain associations via junction table
    if (data.domainIds.length > 0) {
      await tx.insert(playbookDomain).values(
        data.domainIds.map((domainId) => ({
          playbookId: newPlaybook.id,
          domainId,
        })),
      );
    }

    // Insert steps
    if (data.steps.length > 0) {
      await tx.insert(playbookStep).values(
        data.steps.map((step) => ({
          playbookId: newPlaybook.id,
          sequence: step.sequence,
          instruction: step.instruction,
        })),
      );
    }

    return newPlaybook;
  });

  // Invalidate cache
  revalidateTag(CACHE_TAG);
  return result;
}

export async function updatePlaybook(
  id: string,
  data: {
    name?: string;
    description?: string;
    whenToUse?: string;
    domainIds?: string[]; // Now using domain UUIDs
    steps?: { sequence: number; instruction: string }[];
  },
): Promise<Playbook | null> {
  const result = await db.transaction(async (tx) => {
    // Update playbook
    const [updated] = await tx
      .update(playbook)
      .set({
        ...(data.name && { name: data.name }),
        ...(data.description !== undefined && {
          description: data.description,
        }),
        ...(data.whenToUse !== undefined && { whenToUse: data.whenToUse }),
        updatedAt: new Date(),
      })
      .where(eq(playbook.id, id))
      .returning();

    if (!updated) return null;

    // Update domain associations if provided
    if (data.domainIds) {
      // Delete existing domain associations
      await tx.delete(playbookDomain).where(eq(playbookDomain.playbookId, id));

      // Insert new domain associations
      if (data.domainIds.length > 0) {
        await tx.insert(playbookDomain).values(
          data.domainIds.map((domainId) => ({
            playbookId: id,
            domainId,
          })),
        );
      }
    }

    // Update steps if provided
    if (data.steps) {
      // Delete existing steps
      await tx.delete(playbookStep).where(eq(playbookStep.playbookId, id));

      // Insert new steps
      if (data.steps.length > 0) {
        await tx.insert(playbookStep).values(
          data.steps.map((step) => ({
            playbookId: id,
            sequence: step.sequence,
            instruction: step.instruction,
          })),
        );
      }
    }

    return updated;
  });

  // Invalidate cache
  revalidateTag(CACHE_TAG);
  revalidateTag(`playbook-${id}`);
  return result;
}

export async function deletePlaybook(id: string): Promise<boolean> {
  const result = await db
    .delete(playbook)
    .where(eq(playbook.id, id))
    .returning();

  // Invalidate cache
  revalidateTag(CACHE_TAG);
  revalidateTag(`playbook-${id}`);

  return result.length > 0;
}
