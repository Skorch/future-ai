'use server';

import {
  createPlaybook as dbCreatePlaybook,
  updatePlaybook as dbUpdatePlaybook,
  deletePlaybook as dbDeletePlaybook,
} from '@/lib/db/queries/admin/playbooks';
import { getAllDomains } from '@/lib/db/queries/domain';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

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
