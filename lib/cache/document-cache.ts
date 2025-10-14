/**
 * Centralized document cache invalidation (CLIENT-SIDE)
 * Handles SWR cache invalidation
 */

/**
 * Cache keys used across the app for document data
 */
export function getDocumentCacheKeys(
  workspaceId: string,
  documentEnvelopeId: string,
) {
  return {
    // Document versions list
    versions: `/api/workspace/${workspaceId}/document/${documentEnvelopeId}`,
    // Document list (for sidebar, workspace pages)
    list: `/api/workspace/${workspaceId}/document`,
    // History/recent documents
    history: `/api/workspace/${workspaceId}/history`,
  };
}

/**
 * Client-side: Get mutate functions for all document-related SWR caches
 * Use this in client components to invalidate SWR caches
 */
export function createDocumentCacheMutator(
  mutate: (
    key: string | ((key: string) => boolean),
    options?: { revalidate?: boolean },
  ) => Promise<unknown>,
  workspaceId: string,
  documentEnvelopeId: string,
) {
  const keys = getDocumentCacheKeys(workspaceId, documentEnvelopeId);

  return {
    /**
     * Invalidate all document-related caches
     */
    async invalidateAll() {
      await Promise.all([
        // Specific keys
        mutate(keys.versions),
        // Pattern matchers for lists
        mutate(
          (key: string) =>
            typeof key === 'string' &&
            (key.startsWith(keys.list) || key.startsWith(keys.history)),
        ),
      ]);
    },

    /**
     * Invalidate just the document versions
     */
    async invalidateVersions() {
      await mutate(keys.versions);
    },

    /**
     * Invalidate document lists (sidebar, workspace pages)
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
