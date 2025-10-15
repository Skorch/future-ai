import 'server-only';

import { unstable_cache, revalidateTag } from 'next/cache';
import { db } from '@/lib/db/queries';
import {
  playbook,
  playbookStep,
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
        domains: playbook.domains,
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

// Filter playbooks by domain (in-memory, leverages cache)
export async function getPlaybooksForDomain(
  domainId: string,
): Promise<PlaybookMetadata[]> {
  const allPlaybooks = await getAllPlaybooks();
  return allPlaybooks.filter((p) => p.domains.includes(domainId));
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
  domains: string[];
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
        domains: data.domains,
      })
      .returning();

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
    domains?: string[];
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
        ...(data.domains && { domains: data.domains }),
        updatedAt: new Date(),
      })
      .where(eq(playbook.id, id))
      .returning();

    if (!updated) return null;

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
