/**
 * Artifact Registry - Centralized configuration for artifact types
 *
 * Maps artifact kinds to their:
 * - Component definitions (for rendering)
 * - API routes (for fetching/saving)
 * - Metadata and behavior
 *
 * This decouples artifact components from route knowledge, making the system
 * extensible and maintainable.
 */

import { textArtifact } from './document-types/text/client';
import type { Artifact } from '@/components/create-artifact';

/**
 * Configuration for a single artifact kind
 */
export interface ArtifactConfig {
  /**
   * The artifact kind identifier (e.g., 'text', 'knowledge')
   * This is the canonical kind used throughout the system
   */
  kind: string;

  /**
   * The component definition (Artifact instance) to use for rendering
   * Multiple kinds can share the same component
   * Using any here to avoid complex generic constraints across metadata types
   */
  // biome-ignore lint/suspicious/noExplicitAny: Registry needs flexible typing across artifact metadata types
  component: Artifact<string, any>;

  /**
   * API routes for this artifact kind
   */
  routes: {
    /**
     * GET route to fetch document(s)
     * Returns Array<Document> format
     */
    get: (workspaceId: string, documentId: string) => string;

    /**
     * PATCH/POST route to save document changes
     */
    save: (workspaceId: string, documentId: string) => string;
  };

  /**
   * Human-readable description of this artifact type
   */
  description?: string;
}

/**
 * Registry for managing artifact configurations
 */
class ArtifactRegistry {
  private registry = new Map<string, ArtifactConfig>();

  /**
   * Register a new artifact kind
   */
  register(config: ArtifactConfig): void {
    this.registry.set(config.kind, config);
  }

  /**
   * Get full configuration for an artifact kind
   */
  getConfig(kind: string): ArtifactConfig | undefined {
    return this.registry.get(kind);
  }

  /**
   * Get component definition for an artifact kind
   */
  // biome-ignore lint/suspicious/noExplicitAny: Registry needs flexible typing across artifact metadata types
  getComponent(kind: string): Artifact<string, any> | undefined {
    return this.registry.get(kind)?.component;
  }

  /**
   * Get fetch URL for an artifact
   */
  getGetUrl(
    kind: string,
    workspaceId: string,
    documentId: string,
  ): string | null {
    const config = this.registry.get(kind);
    if (!config) {
      return null;
    }
    return config.routes.get(workspaceId, documentId);
  }

  /**
   * Get save URL for an artifact
   */
  getSaveUrl(
    kind: string,
    workspaceId: string,
    documentId: string,
  ): string | null {
    const config = this.registry.get(kind);
    if (!config) {
      return null;
    }
    return config.routes.save(workspaceId, documentId);
  }

  /**
   * Get all registered artifact kinds
   */
  getAllKinds(): string[] {
    return Array.from(this.registry.keys());
  }

  /**
   * Get all configurations (for artifact definitions array)
   */
  getAllConfigs(): ArtifactConfig[] {
    return Array.from(this.registry.values());
  }

  /**
   * Check if a kind is registered
   */
  hasKind(kind: string): boolean {
    return this.registry.has(kind);
  }
}

/**
 * Global artifact registry instance
 */
export const artifactRegistry = new ArtifactRegistry();

/**
 * Register all artifact types
 */

// Text artifacts (objective documents)
artifactRegistry.register({
  kind: 'text',
  component: textArtifact,
  description: 'Text documents stored in objective document system',
  routes: {
    get: (workspaceId, documentId) =>
      `/api/workspace/${workspaceId}/document/${documentId}`,
    save: (workspaceId, documentId) =>
      `/api/workspace/${workspaceId}/document/${documentId}/content`,
  },
});

// Knowledge artifacts (knowledge document system)
artifactRegistry.register({
  kind: 'knowledge',
  component: textArtifact, // Reuse text component for rendering
  description: 'Knowledge documents stored in knowledge document system',
  routes: {
    get: (workspaceId, documentId) =>
      `/api/workspace/${workspaceId}/knowledge/${documentId}`, // Knowledge-specific GET route
    save: (workspaceId, documentId) =>
      `/api/workspace/${workspaceId}/knowledge/${documentId}`, // Knowledge-specific PATCH route
  },
});

/**
 * Export helper type for artifact kinds
 */
export type ArtifactKind = 'text' | 'knowledge';

/**
 * Export registry for use in components
 */
export default artifactRegistry;
