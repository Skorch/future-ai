import type { ArtifactDefinition } from './types';

/**
 * @deprecated This hardcoded artifact registry is being replaced by the database-driven ArtifactType system.
 *
 * **Migration Status**: The system now uses the ArtifactType table for document generation.
 * - New code should query the ArtifactType table and use generateFromArtifactType() instead.
 * - See: lib/db/queries/artifact-handler.ts for the new implementation
 * - See: lib/db/schema.ts for the ArtifactType table definition
 *
 * **Keeping temporarily for**:
 * - Backward compatibility during migration
 * - Any legacy code paths that haven't been updated yet
 *
 * **TODO**: Remove this entirely once all code paths use database-driven artifacts
 */
export const artifactRegistry = {
  'business-requirements': () =>
    import('./document-types/business-requirements'),
  'sales-strategy': () => import('./document-types/sales-strategy'),
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

/**
 * @deprecated Use database queries to fetch ArtifactType records instead.
 *
 * Load all definitions (for prompts, UI, etc.)
 * This function is deprecated - new code should query the ArtifactType table directly.
 *
 * For domain-specific artifact types, use:
 * ```typescript
 * const domain = await getDomainById(domainId);
 * const artifactType = domain.defaultObjectiveArtifactType;
 * ```
 */
export async function getAllDocumentTypes(
  _domainId?: string, // Ignored - domain filtering should come from database
): Promise<ArtifactDefinition[]> {
  return getAllDocumentTypesUnfiltered();
}

// Internal function to load ALL document types (unfiltered)
async function getAllDocumentTypesUnfiltered(): Promise<ArtifactDefinition[]> {
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

// Get display name map for all document types (unfiltered - for display purposes)
export async function getDocumentTypeDisplayMap(): Promise<
  Record<string, string>
> {
  const types = await getAllDocumentTypesUnfiltered();
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
