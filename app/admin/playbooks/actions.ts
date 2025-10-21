'use server';

import {
  createPlaybook as dbCreatePlaybook,
  updatePlaybook as dbUpdatePlaybook,
  deletePlaybook as dbDeletePlaybook,
} from '@/lib/db/queries/playbooks';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

/**
 * @deprecated This action uses legacy domain field. Needs update to use domain UUIDs.
 * TODO: Update admin UI to select domain UUIDs instead of legacy string IDs
 */
export async function createPlaybook(data: {
  name: string;
  description?: string;
  whenToUse?: string;
  domainIds: string[]; // Changed from 'domains' to 'domainIds' to match new schema
  steps: { sequence: number; instruction: string }[];
}) {
  const { userId } = await auth();
  if (!userId) {
    redirect('/login');
  }

  return await dbCreatePlaybook(data);
}

/**
 * @deprecated This action uses legacy domain field. Needs update to use domain UUIDs.
 * TODO: Update admin UI to select domain UUIDs instead of legacy string IDs
 */
export async function updatePlaybook(
  id: string,
  data: {
    name?: string;
    description?: string;
    whenToUse?: string;
    domainIds?: string[]; // Changed from 'domains' to 'domainIds' to match new schema
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
