'use server';

import { z } from 'zod';
import { auth } from '@/app/(auth)/auth';
import {
  createWorkspace,
  updateWorkspace,
  deleteWorkspace,
  getWorkspaceById,
} from './queries';
import { setActiveWorkspace, clearActiveWorkspace } from './context';
import { updateWorkspaceAccess } from './queries';

const createWorkspaceSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
});

const updateWorkspaceSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).optional(),
});

/**
 * Server action to create a new workspace
 */
export async function createWorkspaceAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) {
    throw new Error('Unauthorized');
  }

  const name = formData.get('name') as string;
  const description = formData.get('description') as string | undefined;

  const validated = createWorkspaceSchema.parse({ name, description });

  const ws = await createWorkspace(
    session.user.id,
    validated.name,
    validated.description,
  );

  // Set as active workspace
  await setActiveWorkspace(ws.id);

  return ws;
}

/**
 * Server action to update a workspace
 */
export async function updateWorkspaceAction(
  workspaceId: string,
  formData: FormData,
) {
  const session = await auth();
  if (!session?.user) {
    throw new Error('Unauthorized');
  }

  const name = formData.get('name') as string | undefined;
  const description = formData.get('description') as string | undefined;

  const validated = updateWorkspaceSchema.parse({ name, description });

  const ws = await updateWorkspace(workspaceId, session.user.id, validated);

  return ws;
}

/**
 * Server action to delete a workspace
 */
export async function deleteWorkspaceAction(workspaceId: string) {
  const session = await auth();
  if (!session?.user) {
    throw new Error('Unauthorized');
  }

  const ws = await deleteWorkspace(workspaceId, session.user.id);

  // Clear active workspace cookie if this was the active one
  await clearActiveWorkspace();

  return ws;
}

/**
 * Server action to switch active workspace
 */
export async function switchWorkspaceAction(workspaceId: string) {
  const session = await auth();
  if (!session?.user) {
    throw new Error('Unauthorized');
  }

  // Validate workspace belongs to user
  const ws = await getWorkspaceById(workspaceId, session.user.id);
  if (!ws) {
    throw new Error('Workspace not found');
  }

  // Update cookie
  await setActiveWorkspace(workspaceId);

  // Update last accessed
  await updateWorkspaceAccess(workspaceId);

  return { success: true };
}
