'use server';

import { revalidatePath } from 'next/cache';
import { getLogger } from '@/lib/logger';

const logger = getLogger('AdminActions');

/**
 * Clears all Next.js cache by revalidating all paths
 * This is useful when you need to force-refresh all cached data
 */
export async function clearAllCacheAction() {
  try {
    // Revalidate the entire app from the root
    revalidatePath('/', 'layout');

    logger.info('All cache cleared successfully');

    return { success: true, message: 'All cache cleared successfully' };
  } catch (error) {
    logger.error('Failed to clear cache', error);
    return {
      success: false,
      message: 'Failed to clear cache',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
