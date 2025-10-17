import { getLogger } from '@/lib/logger';

const logger = getLogger('WorkspaceQueries');
import { and, desc, eq, isNull } from 'drizzle-orm';
import { workspace, domain } from '@/lib/db/schema';
import { db } from '@/lib/db/queries';

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
  domainId?: string,
) {
  // Get domain to retrieve default workspace context artifact type
  // If domainId not provided, use first available domain (for backward compatibility)
  let targetDomainId = domainId;

  if (!targetDomainId) {
    // Get first domain as fallback (should be Sales Intelligence based on seed order)
    const [firstDomain] = await db
      .select({ id: domain.id })
      .from(domain)
      .limit(1);

    if (!firstDomain) {
      throw new Error('No domains found in database. Run seed first.');
    }

    targetDomainId = firstDomain.id;
  }

  // Get domain data for workspace context artifact type
  const [domainData] = await db
    .select()
    .from(domain)
    .where(eq(domain.id, targetDomainId))
    .limit(1);

  if (!domainData) {
    throw new Error(`Domain not found: ${targetDomainId}`);
  }

  const [ws] = await db
    .insert(workspace)
    .values({
      userId,
      name,
      description,
      domainId: targetDomainId,
      workspaceContextArtifactTypeId:
        domainData.defaultWorkspaceContextArtifactTypeId,
    })
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
 * Soft delete a workspace - prevents deletion if it's the last workspace
 */
export async function deleteWorkspace(workspaceId: string, userId: string) {
  // Check if this is the last workspace
  const workspaces = await getWorkspacesByUserId(userId);

  if (workspaces.length <= 1) {
    throw new Error(
      'Cannot delete your last workspace. You must have at least one workspace.',
    );
  }

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
 * Throws an error if user has no workspaces (should never happen as workspaces are created during user registration)
 */
export async function getDefaultWorkspace(userId: string) {
  const workspaces = await getWorkspacesByUserId(userId);
  if (workspaces.length === 0) {
    throw new Error(
      `User ${userId} has no workspaces. This should not happen.`,
    );
  }
  return workspaces[0].id;
}

/**
 * Ensure user has at least one workspace, create if missing
 * This is defensive programming - should rarely be needed
 */
export async function ensureUserHasWorkspace(userId: string): Promise<string> {
  const workspaces = await getWorkspacesByUserId(userId);

  if (workspaces.length === 0) {
    // This shouldn't happen, but create a workspace as defensive measure
    logger.error(
      `User ${userId} had no workspaces - creating default workspace`,
    );
    const ws = await createWorkspace(
      userId,
      'Personal Workspace',
      'Automatically created workspace',
    );
    return ws.id;
  }

  return workspaces[0].id;
}

/**
 * Find user's Demo workspace if it exists
 */
export async function findUserDemoWorkspace(userId: string) {
  const demoName = process.env.DEMO_WORKSPACE_NAME || 'Demo';

  const result = await db
    .select()
    .from(workspace)
    .where(
      and(
        eq(workspace.userId, userId),
        eq(workspace.name, demoName),
        isNull(workspace.deletedAt),
      ),
    )
    .limit(1);

  return result[0] || null;
}

/**
 * Get workspace context (for reading only)
 */
export async function getWorkspaceContext(workspaceId: string, userId: string) {
  const [ws] = await db
    .select({
      context: workspace.context,
      contextUpdatedAt: workspace.contextUpdatedAt,
    })
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
 * Update workspace context with new content
 */
export async function updateWorkspaceContext(
  workspaceId: string,
  userId: string,
  context: string,
) {
  const [ws] = await db
    .update(workspace)
    .set({
      context,
      contextUpdatedAt: new Date(),
    })
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

// Phase 2: Objective functions removed
// Use lib/db/objective.ts functions directly for objective operations
