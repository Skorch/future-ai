/**
 * Centralized document cache invalidation (SERVER-SIDE)
 * Handles Next.js revalidatePath for server-rendered pages
 */

import { revalidatePath } from 'next/cache';

/**
 * Next.js paths that need revalidation when a document changes
 */
export function getDocumentRevalidatePaths(
  workspaceId: string,
  documentEnvelopeId: string,
) {
  return [
    // Document detail page
    `/workspace/${workspaceId}/document/${documentEnvelopeId}`,
    // Document edit page
    `/workspace/${workspaceId}/document/${documentEnvelopeId}/edit`,
    // Document list page
    `/workspace/${workspaceId}/document`,
    // Workspace dashboard
    `/workspace/${workspaceId}`,
  ];
}

/**
 * Server-side: Revalidate all Next.js paths related to a document
 * Call this from Server Actions after document mutations
 */
export function revalidateDocumentPaths(
  workspaceId: string,
  documentEnvelopeId: string,
) {
  const paths = getDocumentRevalidatePaths(workspaceId, documentEnvelopeId);
  paths.forEach((path) => revalidatePath(path));
}
