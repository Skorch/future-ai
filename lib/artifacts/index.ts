import type { ArtifactDefinition } from './types';

// Artifact registry - single source of truth for all document types
export const artifactRegistry = {
  text: () => import('./document-types/text'),
  'meeting-analysis': () => import('./document-types/meeting-analysis'),
  'meeting-agenda': () => import('./document-types/meeting-agenda'),
  'meeting-minutes': () => import('./document-types/meeting-minutes'),
  'use-case': () => import('./document-types/use-case'),
  'business-requirements': () =>
    import('./document-types/business-requirements'),
} as const;

// TypeScript type derived from registry keys
export type DocumentType = keyof typeof artifactRegistry;

// Array of keys for Zod enum schemas
export const documentTypes = Object.keys(
  artifactRegistry,
) as Array<DocumentType>;

// Helper to get specific type definition
export async function getDocumentTypeDefinition(
  type: DocumentType,
): Promise<ArtifactDefinition> {
  const loader = artifactRegistry[type];
  if (!loader) {
    throw new Error(`Unknown document type: ${type}`);
  }
  const artifactModule = await loader();
  return {
    metadata: artifactModule.metadata,
    handler: artifactModule.handler,
  };
}

// Load all definitions (for prompts, UI, etc.)
export async function getAllDocumentTypes(): Promise<ArtifactDefinition[]> {
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

// Get display name map for all document types
export async function getDocumentTypeDisplayMap(): Promise<
  Record<string, string>
> {
  const types = await getAllDocumentTypes();
  const displayMap: Record<string, string> = {};

  types.forEach((typeDef) => {
    displayMap[typeDef.metadata.type] = typeDef.metadata.name;
  });

  // Add special non-registry type for transcripts (uploaded, not generated)
  displayMap.transcript = 'Transcript';

  return displayMap;
}

// Legacy aliases for backward compatibility
export type ArtifactType = DocumentType;
export const loadAllArtifactDefinitions = getAllDocumentTypes;
export const getArtifact = getDocumentTypeDefinition;
