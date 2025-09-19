import type { ArtifactDefinition } from './types';

// Artifact registry - single source of truth for all artifacts
export const artifactRegistry = {
  'meeting-summary': () => import('@/artifacts/meeting-summary'),
  // Add new artifacts here:
  // 'meeting-agenda': () => import('@/artifacts/meeting-agenda'),
  // 'product-requirements': () => import('@/artifacts/product-requirements'),
} as const;

export type ArtifactType = keyof typeof artifactRegistry;

// Helper to load all artifact definitions (for system prompt generation)
export async function loadAllArtifactDefinitions(): Promise<
  ArtifactDefinition[]
> {
  const definitions = await Promise.all(
    Object.values(artifactRegistry).map(async (loader) => {
      const artifactModule = await loader();
      return {
        metadata: artifactModule.metadata,
        handler: artifactModule.handler,
      };
    }),
  );
  return definitions;
}

// Helper to get a specific artifact
export async function getArtifact(
  type: ArtifactType,
): Promise<ArtifactDefinition> {
  const loader = artifactRegistry[type];
  if (!loader) {
    throw new Error(`Unknown artifact type: ${type}`);
  }
  const artifactModule = await loader();
  return {
    metadata: artifactModule.metadata,
    handler: artifactModule.handler,
  };
}
