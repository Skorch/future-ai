'use server';

import { z } from 'zod';
import { auth } from '@clerk/nextjs/server';
import {
  createWorkspace,
  updateWorkspace,
  deleteWorkspace,
  getWorkspaceById,
  updateWorkspaceAccess,
} from './queries';
import { setActiveWorkspace, clearActiveWorkspace } from './context';

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
  const { userId } = await auth();
  if (!userId) {
    throw new Error('Unauthorized');
  }

  const name = formData.get('name') as string;
  const description = formData.get('description') as string | undefined;

  const validated = createWorkspaceSchema.parse({ name, description });

  const ws = await createWorkspace(
    userId,
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
  const { userId } = await auth();
  if (!userId) {
    throw new Error('Unauthorized');
  }

  const name = formData.get('name') as string | undefined;
  const description = formData.get('description') as string | undefined;

  const validated = updateWorkspaceSchema.parse({ name, description });

  const ws = await updateWorkspace(workspaceId, userId, validated);

  return ws;
}

/**
 * Server action to delete a workspace
 */
export async function deleteWorkspaceAction(workspaceId: string) {
  const { userId } = await auth();
  if (!userId) {
    throw new Error('Unauthorized');
  }

  const ws = await deleteWorkspace(workspaceId, userId);

  // Clear active workspace cookie if this was the active one
  await clearActiveWorkspace();

  return ws;
}

/**
 * Server action to switch active workspace
 */
export async function switchWorkspaceAction(workspaceId: string) {
  const { userId } = await auth();
  if (!userId) {
    throw new Error('Unauthorized');
  }

  // Validate workspace belongs to user
  const ws = await getWorkspaceById(workspaceId, userId);
  if (!ws) {
    throw new Error('Workspace not found');
  }

  // Update cookie
  await setActiveWorkspace(workspaceId);

  // Update last accessed
  await updateWorkspaceAccess(workspaceId);

  return { success: true };
}
