/**
 * Centralized knowledge document cache invalidation (CLIENT-SIDE)
 * Handles SWR cache invalidation for knowledge documents
 */

/**
 * Cache keys used across the app for knowledge document data
 */
export function getKnowledgeCacheKeys(
  workspaceId: string,
  knowledgeId: string,
) {
  return {
    // Single knowledge document
    document: `/api/workspace/${workspaceId}/knowledge/${knowledgeId}`,
    // Knowledge document list
    list: `/api/workspace/${workspaceId}/knowledge`,
    // History/recent documents
    history: `/api/workspace/${workspaceId}/history`,
  };
}

/**
 * Client-side: Get mutate functions for all knowledge document-related SWR caches
 * Use this in client components to invalidate SWR caches
 */
export function createKnowledgeCacheMutator(
  mutate: (
    key: string | ((key: string) => boolean),
    options?: { revalidate?: boolean },
  ) => Promise<unknown>,
  workspaceId: string,
  knowledgeId: string,
) {
  const keys = getKnowledgeCacheKeys(workspaceId, knowledgeId);

  return {
    /**
     * Invalidate all knowledge document-related caches
     */
    async invalidateAll() {
      await Promise.all([
        // Specific keys
        mutate(keys.document),
        // Pattern matchers for lists
        mutate(
          (key: string) =>
            typeof key === 'string' &&
            (key.startsWith(keys.list) || key.startsWith(keys.history)),
        ),
      ]);
    },

    /**
     * Invalidate just the knowledge document
     */
    async invalidateDocument() {
      await mutate(keys.document);
    },

    /**
     * Invalidate knowledge document lists (sidebar, workspace pages)
     */
    async invalidateLists() {
      await mutate(
        (key: string) =>
          typeof key === 'string' &&
          (key.startsWith(keys.list) || key.startsWith(keys.history)),
      );
    },
  };
}
