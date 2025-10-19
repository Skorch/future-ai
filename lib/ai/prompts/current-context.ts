import type { User } from '@/lib/db/schema';

export interface CurrentContextOptions {
  user: Pick<User, 'firstName' | 'lastName'> | null;
}

/**
 * Generate current context XML block for AI prompts
 * Injects active user and current datetime information
 *
 * @param options - Object containing user info
 * @returns XML string with active_user and current_datetime tags
 *
 * @example
 * const context = getCurrentContext({ user: { firstName: 'John', lastName: 'Doe' } });
 * // Returns: <active_user>John Doe</active_user>\n<current_datetime>2025-01-19T...</current_datetime>
 */
export function getCurrentContext({ user }: CurrentContextOptions): string {
  const now = new Date();
  const dateStr = now.toISOString();

  const userName =
    user?.firstName && user?.lastName
      ? `${user.firstName} ${user.lastName}`
      : 'Unknown User';

  return `<active_user>${userName}</active_user>
<current_datetime>${dateStr}</current_datetime>`;
}
