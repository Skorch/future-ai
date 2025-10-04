'use server';

import {
  createPlaybook as dbCreatePlaybook,
  updatePlaybook as dbUpdatePlaybook,
  deletePlaybook as dbDeletePlaybook,
} from '@/lib/db/queries/playbooks';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

export async function createPlaybook(data: {
  name: string;
  description?: string;
  whenToUse?: string;
  domains: string[];
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
    domains?: string[];
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
