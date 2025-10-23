/**
 * Artifact System - Category-Based Architecture
 *
 * This module exports the category-based artifact handler system.
 * All artifact generation now uses database-driven ArtifactType configuration
 * with category handlers (objective, actions, context, summary).
 *
 * For artifact type management, see:
 * - lib/db/queries/artifact-type.ts - DAL for artifact types
 * - lib/db/schema.ts - ArtifactType table definition
 * - lib/artifacts/category-handlers/ - Category handler implementations
 */

// Re-export category handler system
export { getCategoryHandler } from './category-handlers';
export type {
  CategoryHandler,
  GenerationContext,
} from './category-handlers/types';

// Re-export client-safe utilities
export { documentTypeDisplayNames } from './client';
