import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { getLogger } from '@/lib/logger';

const logger = getLogger('Auth');

export interface ActionResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
  revalidate?: {
    paths?: string[];
    swrKeys?: string[];
  };
}

/**
 * Wrapper for server actions that handles authentication and error handling
 * @param actionName - Name of the action for logging
 * @param fn - The action handler function that returns ActionResult
 * @returns Wrapped server action with auth and error handling
 */
export function withAuth<TArgs extends unknown[], TData = void>(
  actionName: string,
  fn: (userId: string, ...args: TArgs) => Promise<ActionResult<TData>>,
): (...args: TArgs) => Promise<ActionResult<TData>> {
  return async (...args: TArgs): Promise<ActionResult<TData>> => {
    try {
      const session = await auth();

      if (!session?.userId) {
        logger.warn('Unauthorized access attempt', { actionName });
        redirect('/login');
      }

      // The inner function already returns ActionResult
      return await fn(session.userId, ...args);
    } catch (error) {
      // Re-throw Next.js navigation errors (redirect, notFound, etc.)
      // These should not be caught and converted to ActionResult
      if (error instanceof Error && error.message === 'NEXT_REDIRECT') {
        throw error;
      }

      logger.error('Server action failed', {
        action: actionName,
        error, // Logger accepts error directly
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Operation failed',
      };
    }
  };
}
