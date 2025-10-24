'use server';

import {
  createPlaybook as dbCreatePlaybook,
  updatePlaybook as dbUpdatePlaybook,
  deletePlaybook as dbDeletePlaybook,
  clonePlaybook as dbClonePlaybook,
} from '@/lib/db/queries/admin/playbooks';
import { getAllDomains } from '@/lib/db/queries/domain';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { revalidateTag } from 'next/cache';
import { getLogger } from '@/lib/logger';

const logger = getLogger('AdminPlaybooks');

export async function getDomainsForForm() {
  const domains = await getAllDomains();
  return domains.map((d) => ({
    id: d.id,
    title: d.title,
    description: d.description,
  }));
}

export async function createPlaybook(data: {
  name: string;
  description?: string;
  whenToUse?: string;
  domainIds: string[];
  steps: { sequence: number; instruction: string }[];
}) {
  const { userId } = await auth();
  if (!userId) {
    redirect('/login');
  }

  return await dbCreatePlaybook(data);
}

export async function updatePlaybook(
  id: string,
  data: {
    name?: string;
    description?: string;
    whenToUse?: string;
    domainIds?: string[];
    steps?: { sequence: number; instruction: string }[];
  },
) {
  const { userId } = await auth();
  if (!userId) {
    redirect('/login');
  }

  return await dbUpdatePlaybook(id, data);
}

export async function deletePlaybook(id: string) {
  const { userId } = await auth();
  if (!userId) {
    redirect('/login');
  }

  return await dbDeletePlaybook(id);
}

export async function clonePlaybookAction(
  playbookId: string,
  newName: string,
): Promise<{ success: true; playbookId: string }> {
  const { userId } = await auth();
  if (!userId) {
    redirect('/login');
  }

  try {
    const clonedPlaybook = await dbClonePlaybook(playbookId, newName);

    // Revalidate cache
    revalidateTag('playbooks');

    logger.info('Playbook cloned successfully', {
      sourceId: playbookId,
      newId: clonedPlaybook.id,
      newName,
      userId,
    });

    return {
      success: true,
      playbookId: clonedPlaybook.id,
    };
  } catch (error) {
    logger.error('Failed to clone playbook', {
      playbookId,
      newName,
      userId,
      error,
    });
    throw error;
  }
}
