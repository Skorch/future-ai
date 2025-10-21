import 'server-only';

import { unstable_cache } from 'next/cache';
import { db } from '@/lib/db/queries';
import {
  playbook,
  playbookStep,
  playbookDomain,
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
