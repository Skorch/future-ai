import type { ArtifactDefinition } from './types';
import type { DomainId } from '@/lib/domains';
import { getDomain } from '@/lib/domains';

// Artifact registry - single source of truth for all document types
export const artifactRegistry = {
  text: () => import('./document-types/text'),
  'meeting-analysis': () => import('./document-types/meeting-analysis'),
  'meeting-agenda': () => import('./document-types/meeting-agenda'),
  'meeting-minutes': () => import('./document-types/meeting-minutes'),
  'use-case': () => import('./document-types/use-case'),
  'business-requirements': () =>
    import('./document-types/business-requirements'),
  'sales-call-summary': () => import('./document-types/sales-call-summary'),
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

// Load all definitions (for prompts, UI, etc.)
// Filtered by domain - only returns types allowed in the given domain
export async function getAllDocumentTypes(
  domainId: DomainId,
): Promise<ArtifactDefinition[]> {
  const domain = getDomain(domainId);
  const allowedTypes = domain.allowedTypes;

  // Filter registry entries by domain's allowed types
  const entries = Object.entries(artifactRegistry).filter(([key]) =>
    allowedTypes.includes(key as DocumentType),
  );

  const definitions = await Promise.all(
    entries.map(async ([, loader]) => {
      const artifactModule = await loader();
      return {
        metadata: artifactModule.metadata,
        handler: artifactModule.handler,
      };
    }),
  );
  return definitions;
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
