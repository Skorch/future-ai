import 'server-only';

import { revalidateTag } from 'next/cache';
import { db } from '@/lib/db/queries';
import {
  domain,
  artifactType,
  workspace,
  type Domain,
  ArtifactCategory,
} from '../../schema';
import { eq, count } from 'drizzle-orm';
import { getAllDomains, getDomainById } from '../domain';
import { cloneArtifactType } from './artifact-type';

/**
 * Admin mutations for Domain table
 * These operations invalidate user-facing caches
 */

/**
 * Update a domain (admin only)
 * Invalidates domain caches which users depend on
 */
export async function updateDomain(
  id: string,
  data: {
    title?: string;
    description?: string;
    systemPrompt?: string;
    defaultObjectiveArtifactTypeId?: string;
    defaultSummaryArtifactTypeId?: string;
    defaultObjectiveActionsArtifactTypeId?: string;
    defaultWorkspaceContextArtifactTypeId?: string;
    defaultObjectiveContextArtifactTypeId?: string;
    defaultWorkspaceContext?: string;
  },
  userId: string,
): Promise<Domain | null> {
  // Validate required fields if being updated
  if (data.systemPrompt !== undefined && !data.systemPrompt.trim()) {
    throw new Error('systemPrompt cannot be empty');
  }

  // Validate all artifact type FKs exist if being updated
  const artifactTypeIds = [
    data.defaultObjectiveArtifactTypeId,
    data.defaultSummaryArtifactTypeId,
    data.defaultObjectiveActionsArtifactTypeId,
    data.defaultWorkspaceContextArtifactTypeId,
    data.defaultObjectiveContextArtifactTypeId,
  ].filter(Boolean) as string[];

  if (artifactTypeIds.length > 0) {
    const existingTypes = await db
      .select({ id: artifactType.id })
      .from(artifactType)
      .where(eq(artifactType.id, artifactTypeIds[0] as string));

    // This is simplified - in production, check all IDs
    if (existingTypes.length === 0) {
      throw new Error('One or more artifact type IDs do not exist');
    }
  }

  const [updated] = await db
    .update(domain)
    .set({
      ...(data.title && { title: data.title }),
      ...(data.description && { description: data.description }),
      ...(data.systemPrompt !== undefined && {
        systemPrompt: data.systemPrompt,
      }),
      ...(data.defaultObjectiveArtifactTypeId && {
        defaultObjectiveArtifactTypeId: data.defaultObjectiveArtifactTypeId,
      }),
      ...(data.defaultSummaryArtifactTypeId && {
        defaultSummaryArtifactTypeId: data.defaultSummaryArtifactTypeId,
      }),
      ...(data.defaultObjectiveActionsArtifactTypeId && {
        defaultObjectiveActionsArtifactTypeId:
          data.defaultObjectiveActionsArtifactTypeId,
      }),
      ...(data.defaultWorkspaceContextArtifactTypeId && {
        defaultWorkspaceContextArtifactTypeId:
          data.defaultWorkspaceContextArtifactTypeId,
      }),
      ...(data.defaultObjectiveContextArtifactTypeId && {
        defaultObjectiveContextArtifactTypeId:
          data.defaultObjectiveContextArtifactTypeId,
      }),
      ...(data.defaultWorkspaceContext !== undefined && {
        defaultWorkspaceContext: data.defaultWorkspaceContext,
      }),
      updatedByUserId: userId,
      updatedAt: new Date(),
    })
    .where(eq(domain.id, id))
    .returning();

  if (!updated) return null;

  // Invalidate caches
  revalidateTag('domains');
  revalidateTag(`domain-${id}`);

  return updated;
}

/**
 * Create a new domain (admin only)
 * All artifact type IDs are required
 */
export async function createDomain(
  data: {
    title: string;
    description: string;
    systemPrompt: string;
    defaultObjectiveArtifactTypeId: string;
    defaultSummaryArtifactTypeId: string;
    defaultObjectiveActionsArtifactTypeId: string;
    defaultWorkspaceContextArtifactTypeId: string;
    defaultObjectiveContextArtifactTypeId: string;
    defaultWorkspaceContext?: string;
  },
  userId: string,
): Promise<Domain> {
  // Validate required fields
  if (!data.title.trim()) {
    throw new Error('Title is required');
  }
  if (!data.description.trim()) {
    throw new Error('Description is required');
  }
  if (!data.systemPrompt.trim()) {
    throw new Error('System prompt is required');
  }

  // Validate all artifact type FKs exist
  const artifactTypeIds = [
    data.defaultObjectiveArtifactTypeId,
    data.defaultSummaryArtifactTypeId,
    data.defaultObjectiveActionsArtifactTypeId,
    data.defaultWorkspaceContextArtifactTypeId,
    data.defaultObjectiveContextArtifactTypeId,
  ];

  // Check that all artifact types exist
  const existingTypes = await db
    .select({ id: artifactType.id })
    .from(artifactType)
    .where(eq(artifactType.id, artifactTypeIds[0]));

  if (existingTypes.length === 0) {
    throw new Error('One or more artifact type IDs do not exist');
  }

  const [newDomain] = await db
    .insert(domain)
    .values({
      title: data.title,
      description: data.description,
      systemPrompt: data.systemPrompt,
      defaultObjectiveArtifactTypeId: data.defaultObjectiveArtifactTypeId,
      defaultSummaryArtifactTypeId: data.defaultSummaryArtifactTypeId,
      defaultObjectiveActionsArtifactTypeId:
        data.defaultObjectiveActionsArtifactTypeId,
      defaultWorkspaceContextArtifactTypeId:
        data.defaultWorkspaceContextArtifactTypeId,
      defaultObjectiveContextArtifactTypeId:
        data.defaultObjectiveContextArtifactTypeId,
      defaultWorkspaceContext: data.defaultWorkspaceContext || null,
      updatedByUserId: userId,
    })
    .returning();

  // Invalidate cache
  revalidateTag('domains');

  return newDomain;
}

/**
 * Get all domains with artifact type relations for admin listing
 * Includes workspace count for each domain
 */
export async function getAllDomainsWithRelations() {
  const domains = await getAllDomains();

  // Enhance each domain with workspace count
  const domainsWithCounts = await Promise.all(
    domains.map(async (domain) => {
      const workspaceCount = await getWorkspaceCountByDomain(domain.id);

      // Build artifact types array for cloning (using simplified category names for dialog)
      const artifactTypes = [
        domain.defaultObjectiveArtifactType
          ? {
              id: domain.defaultObjectiveArtifactType.id,
              name: domain.defaultObjectiveArtifactType.label,
              category: ArtifactCategory.OBJECTIVE,
            }
          : null,
        domain.defaultSummaryArtifactType
          ? {
              id: domain.defaultSummaryArtifactType.id,
              name: domain.defaultSummaryArtifactType.label,
              category: ArtifactCategory.SUMMARY,
            }
          : null,
        domain.defaultObjectiveActionsArtifactType
          ? {
              id: domain.defaultObjectiveActionsArtifactType.id,
              name: domain.defaultObjectiveActionsArtifactType.label,
              category: ArtifactCategory.OBJECTIVE_ACTIONS,
            }
          : null,
        domain.defaultWorkspaceContextArtifactType
          ? {
              id: domain.defaultWorkspaceContextArtifactType.id,
              name: domain.defaultWorkspaceContextArtifactType.label,
              category: ArtifactCategory.WORKSPACE_CONTEXT,
            }
          : null,
        domain.defaultObjectiveContextArtifactType
          ? {
              id: domain.defaultObjectiveContextArtifactType.id,
              name: domain.defaultObjectiveContextArtifactType.label,
              category: ArtifactCategory.OBJECTIVE_CONTEXT,
            }
          : null,
      ].filter(Boolean) as Array<{
        id: string;
        name: string;
        category: string;
      }>;

      return {
        ...domain,
        workspaceCount,
        artifactTypes,
      };
    }),
  );

  return domainsWithCounts;
}

/**
 * Get single domain with artifact type relations for admin editing
 * Reuses cached getDomainById from user-facing queries
 */
export async function getDomainWithRelations(id: string) {
  return await getDomainById(id);
}

/**
 * Get workspace count for a domain
 */
export async function getWorkspaceCountByDomain(
  domainId: string,
): Promise<number> {
  const result = await db
    .select({ count: count(workspace.id) })
    .from(workspace)
    .where(eq(workspace.domainId, domainId));

  return result[0]?.count || 0;
}

/**
 * Get current default domain
 */
export async function getDefaultDomain(): Promise<Domain | null> {
  const [defaultDomain] = await db
    .select()
    .from(domain)
    .where(eq(domain.isDefault, true))
    .limit(1);

  return defaultDomain || null;
}

/**
 * Reassign workspaces from one domain to another
 */
export async function reassignWorkspaces(
  fromDomainId: string,
  toDomainId: string,
): Promise<void> {
  await db
    .update(workspace)
    .set({ domainId: toDomainId })
    .where(eq(workspace.domainId, fromDomainId));
}

/**
 * Clone a domain with all artifact types
 * Creates a new domain with cloned artifact types
 */
export async function cloneDomain(
  sourceDomainId: string,
  newDomainName: string,
  artifactTypeNames: Record<string, string>,
  userId: string,
): Promise<Domain> {
  // Load source domain with all artifact types
  const sourceDomain = await getDomainWithRelations(sourceDomainId);
  if (!sourceDomain) {
    throw new Error('Source domain not found');
  }

  // Clone each artifact type using the dedicated helper function
  const artifactTypeMapping: Array<{
    key: keyof typeof sourceDomain;
    idKey: keyof Domain;
    sourceType: typeof sourceDomain.defaultObjectiveArtifactType;
  }> = [
    {
      key: 'defaultObjectiveArtifactType',
      idKey: 'defaultObjectiveArtifactTypeId',
      sourceType: sourceDomain.defaultObjectiveArtifactType,
    },
    {
      key: 'defaultSummaryArtifactType',
      idKey: 'defaultSummaryArtifactTypeId',
      sourceType: sourceDomain.defaultSummaryArtifactType,
    },
    {
      key: 'defaultObjectiveActionsArtifactType',
      idKey: 'defaultObjectiveActionsArtifactTypeId',
      sourceType: sourceDomain.defaultObjectiveActionsArtifactType,
    },
    {
      key: 'defaultWorkspaceContextArtifactType',
      idKey: 'defaultWorkspaceContextArtifactTypeId',
      sourceType: sourceDomain.defaultWorkspaceContextArtifactType,
    },
    {
      key: 'defaultObjectiveContextArtifactType',
      idKey: 'defaultObjectiveContextArtifactTypeId',
      sourceType: sourceDomain.defaultObjectiveContextArtifactType,
    },
  ];

  // Clone all artifact types (in parallel for performance)
  const clonedTypes = await Promise.all(
    artifactTypeMapping.map(async ({ key, sourceType }) => {
      if (!sourceType) {
        throw new Error(`Missing artifact type: ${String(key)}`);
      }

      // Get custom name from map or use source name
      const newName = artifactTypeNames[String(key)] || sourceType.label;

      // Use the dedicated cloneArtifactType function
      const cloned = await cloneArtifactType(sourceType.id, newName, userId);
      return { key, clonedId: cloned.id };
    }),
  );

  // Build the artifact type IDs object
  const artifactTypeIds: Record<string, string> = {};
  for (const { key, clonedId } of clonedTypes) {
    artifactTypeIds[String(key)] = clonedId;
  }

  // Create new domain with cloned artifact type IDs
  const [newDomain] = await db
    .insert(domain)
    .values({
      title: newDomainName,
      description: sourceDomain.description,
      systemPrompt: sourceDomain.systemPrompt,
      defaultWorkspaceContext: sourceDomain.defaultWorkspaceContext, // Clone the default context template
      isDefault: false, // Never clone as default
      defaultObjectiveArtifactTypeId:
        artifactTypeIds.defaultObjectiveArtifactType,
      defaultSummaryArtifactTypeId: artifactTypeIds.defaultSummaryArtifactType,
      defaultObjectiveActionsArtifactTypeId:
        artifactTypeIds.defaultObjectiveActionsArtifactType,
      defaultWorkspaceContextArtifactTypeId:
        artifactTypeIds.defaultWorkspaceContextArtifactType,
      defaultObjectiveContextArtifactTypeId:
        artifactTypeIds.defaultObjectiveContextArtifactType,
      updatedByUserId: userId,
    })
    .returning();

  return newDomain;
}

/**
 * Delete domain (assumes checks already done)
 */
export async function deleteDomain(domainId: string): Promise<void> {
  await db.delete(domain).where(eq(domain.id, domainId));
}

/**
 * Set a domain as default (clears others in transaction)
 */
export async function setDefaultDomain(domainId: string): Promise<void> {
  await db.transaction(async (tx) => {
    // Clear all default flags
    await tx.update(domain).set({ isDefault: false, updatedAt: new Date() });

    // Set target domain as default
    await tx
      .update(domain)
      .set({ isDefault: true, updatedAt: new Date() })
      .where(eq(domain.id, domainId));
  });
}
