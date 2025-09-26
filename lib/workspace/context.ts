import { cookies } from 'next/headers';
import { getWorkspaceById, ensureUserHasWorkspace } from './queries';

const WORKSPACE_COOKIE_NAME = 'clerk-active-workspace';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

/**
 * Get the active workspace ID from cookies, or return default
 * Note: This function cannot set cookies as it may be called from Server Components
 */
export async function getActiveWorkspace(userId: string): Promise<string> {
  const cookieStore = await cookies();
  const activeWorkspaceId = cookieStore.get(WORKSPACE_COOKIE_NAME)?.value;

  if (activeWorkspaceId) {
    // Validate workspace belongs to user
    const ws = await getWorkspaceById(activeWorkspaceId, userId);
    if (ws) {
      return ws.id;
    }
  }

  // No valid workspace in cookie, return the user's default workspace
  // Note: We don't set the cookie here as this may be called from Server Components
  const workspaceId = await ensureUserHasWorkspace(userId);
  return workspaceId;
}

/**
 * Set the active workspace in cookies
 */
export async function setActiveWorkspace(workspaceId: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(WORKSPACE_COOKIE_NAME, workspaceId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: COOKIE_MAX_AGE,
  });
}

/**
 * Clear the active workspace cookie
 */
export async function clearActiveWorkspace(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(WORKSPACE_COOKIE_NAME);
}

/**
 * Ensure user has a workspace and return its ID
 * This is a convenience wrapper around the query function
 */
export async function ensureUserWorkspace(userId: string): Promise<string> {
  return ensureUserHasWorkspace(userId);
}
