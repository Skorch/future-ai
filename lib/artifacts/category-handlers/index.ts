import 'server-only';

import type { CategoryHandler } from './types';
import { getArtifactTypeById } from '@/lib/db/queries/artifact-type';
import type { artifactTypeCategoryEnum, ArtifactType } from '@/lib/db/schema';
import { ObjectiveHandler } from './objective-handler';
import { ActionsHandler } from './actions-handler';
import { ContextHandler } from './context-handler';
import { SummaryHandler } from './summary-handler';

// Extract the enum values type from the Drizzle enum
type ArtifactTypeCategoryEnum =
  (typeof artifactTypeCategoryEnum.enumValues)[number];

/**
 * Category Handler Registry
 *
 * Maps each artifact type category to its corresponding handler.
 * Handlers implement category-specific generation logic.
 */
const categoryHandlers: Record<ArtifactTypeCategoryEnum, CategoryHandler> = {
  objective: new ObjectiveHandler(),
  objectiveActions: new ActionsHandler(),
  context: new ContextHandler(),
  summary: new SummaryHandler(),
};

/**
 * Get the category handler for a given artifact type ID
 *
 * @param artifactTypeId - The artifact type ID to look up
 * @returns Object containing the handler and artifact type configuration
 * @throws Error if artifact type not found or no handler for category
 */
export async function getCategoryHandler(artifactTypeId: string): Promise<{
  handler: CategoryHandler;
  artifactType: ArtifactType;
}> {
  // Fetch the artifact type configuration
  const artifactType = await getArtifactTypeById(artifactTypeId);

  if (!artifactType) {
    throw new Error(`Artifact type not found: ${artifactTypeId}`);
  }

  // Get the handler for this category
  const handler = categoryHandlers[artifactType.category];

  if (!handler) {
    throw new Error(
      `No handler registered for category: ${artifactType.category}`,
    );
  }

  return { handler, artifactType };
}
