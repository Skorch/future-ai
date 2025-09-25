import { and, desc, eq, isNull } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { workspace } from '@/lib/db/schema';

// biome-ignore lint: Forbidden non-null assertion.
const client = postgres(process.env.POSTGRES_URL!);
const db = drizzle(client);

/**
 * Get all workspaces for a user (excluding soft-deleted)
 */
export async function getWorkspacesByUserId(userId: string) {
  return await db
    .select()
    .from(workspace)
    .where(and(eq(workspace.userId, userId), isNull(workspace.deletedAt)))
    .orderBy(desc(workspace.lastAccessedAt));
}

/**
 * Get a specific workspace by ID, ensuring it belongs to the user
 */
export async function getWorkspaceById(workspaceId: string, userId: string) {
  const [ws] = await db
    .select()
    .from(workspace)
    .where(
      and(
        eq(workspace.id, workspaceId),
        eq(workspace.userId, userId),
        isNull(workspace.deletedAt),
      ),
    );
  return ws;
}

/**
 * Create a new workspace for a user
 */
export async function createWorkspace(
  userId: string,
  name: string,
  description?: string,
) {
  const [ws] = await db
    .insert(workspace)
    .values({ userId, name, description })
    .returning();
  return ws;
}

/**
 * Update workspace last accessed time
 */
export async function updateWorkspaceAccess(workspaceId: string) {
  await db
    .update(workspace)
    .set({ lastAccessedAt: new Date() })
    .where(eq(workspace.id, workspaceId));
}

/**
 * Update workspace details
 */
export async function updateWorkspace(
  workspaceId: string,
  userId: string,
  data: { name?: string; description?: string },
) {
  const [ws] = await db
    .update(workspace)
    .set(data)
    .where(
      and(
        eq(workspace.id, workspaceId),
        eq(workspace.userId, userId),
        isNull(workspace.deletedAt),
      ),
    )
    .returning();
  return ws;
}

/**
 * Soft delete a workspace
 */
export async function deleteWorkspace(workspaceId: string, userId: string) {
  const [ws] = await db
    .update(workspace)
    .set({ deletedAt: new Date() })
    .where(
      and(
        eq(workspace.id, workspaceId),
        eq(workspace.userId, userId),
        isNull(workspace.deletedAt),
      ),
    )
    .returning();
  return ws;
}

/**
 * Get the user's default workspace (most recently accessed)
 */
export async function getDefaultWorkspace(userId: string) {
  const workspaces = await getWorkspacesByUserId(userId);
  if (workspaces.length === 0) {
    // If no workspaces exist, create a Personal workspace
    const ws = await createWorkspace(
      userId,
      'Personal',
      'Your personal workspace',
    );
    return ws.id;
  }
  return workspaces[0].id;
}

/**
 * Ensure a user has at least one workspace
 */
export async function ensureUserHasWorkspace(userId: string): Promise<string> {
  const workspaces = await getWorkspacesByUserId(userId);

  if (workspaces.length === 0) {
    const ws = await createWorkspace(
      userId,
      'Personal',
      'Your personal workspace',
    );
    return ws.id;
  }

  // Return the most recently accessed workspace
  return workspaces[0].id;
}
