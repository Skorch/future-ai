import 'server-only';

import { unstable_cache } from 'next/cache';
import { db } from '@/lib/db/queries';
import {
  domain,
  artifactType,
  workspace,
  type DomainWithRelations,
} from '../schema';
import { eq } from 'drizzle-orm';

// Cache tag for invalidation
const CACHE_TAG = 'domains';

/**
 * Fetch all domains with nested artifact type relations (cached)
 */
export const getAllDomains = unstable_cache(
  async (): Promise<DomainWithRelations[]> => {
    const domains = await db.select().from(domain).orderBy(domain.title);

    // Load all artifact types for each domain
    const domainsWithRelations: DomainWithRelations[] = await Promise.all(
      domains.map(async (d) => {
        const [
          defaultObjectiveArtifactType,
          defaultSummaryArtifactType,
          defaultObjectiveActionsArtifactType,
          defaultWorkspaceContextArtifactType,
          defaultObjectiveContextArtifactType,
        ] = await Promise.all([
          db
            .select()
            .from(artifactType)
            .where(eq(artifactType.id, d.defaultObjectiveArtifactTypeId))
            .limit(1)
            .then((r) => r[0] || undefined),
          db
            .select()
            .from(artifactType)
            .where(eq(artifactType.id, d.defaultSummaryArtifactTypeId))
            .limit(1)
            .then((r) => r[0] || undefined),
          db
            .select()
            .from(artifactType)
            .where(eq(artifactType.id, d.defaultObjectiveActionsArtifactTypeId))
            .limit(1)
            .then((r) => r[0] || undefined),
          db
            .select()
            .from(artifactType)
            .where(eq(artifactType.id, d.defaultWorkspaceContextArtifactTypeId))
            .limit(1)
            .then((r) => r[0] || undefined),
          db
            .select()
            .from(artifactType)
            .where(eq(artifactType.id, d.defaultObjectiveContextArtifactTypeId))
            .limit(1)
            .then((r) => r[0] || undefined),
        ]);

        return {
          ...d,
          defaultObjectiveArtifactType,
          defaultSummaryArtifactType,
          defaultObjectiveActionsArtifactType,
          defaultWorkspaceContextArtifactType,
          defaultObjectiveContextArtifactType,
        };
      }),
    );

    return domainsWithRelations;
  },
  ['all-domains'],
  {
    tags: [CACHE_TAG],
    revalidate: false, // Cache until explicitly invalidated
  },
);

/**
 * Fetch single domain by ID with nested relations (cached per ID)
 */
export const getDomainById = (id: string) =>
  unstable_cache(
    async (): Promise<DomainWithRelations | null> => {
      const [domainData] = await db
        .select()
        .from(domain)
        .where(eq(domain.id, id))
        .limit(1);

      if (!domainData) return null;

      // Load all artifact types
      const [
        defaultObjectiveArtifactType,
        defaultSummaryArtifactType,
        defaultObjectiveActionsArtifactType,
        defaultWorkspaceContextArtifactType,
        defaultObjectiveContextArtifactType,
      ] = await Promise.all([
        db
          .select()
          .from(artifactType)
          .where(eq(artifactType.id, domainData.defaultObjectiveArtifactTypeId))
          .limit(1)
          .then((r) => r[0] || undefined),
        db
          .select()
          .from(artifactType)
          .where(eq(artifactType.id, domainData.defaultSummaryArtifactTypeId))
          .limit(1)
          .then((r) => r[0] || undefined),
        db
          .select()
          .from(artifactType)
          .where(
            eq(
              artifactType.id,
              domainData.defaultObjectiveActionsArtifactTypeId,
            ),
          )
          .limit(1)
          .then((r) => r[0] || undefined),
        db
          .select()
          .from(artifactType)
          .where(
            eq(
              artifactType.id,
              domainData.defaultWorkspaceContextArtifactTypeId,
            ),
          )
          .limit(1)
          .then((r) => r[0] || undefined),
        db
          .select()
          .from(artifactType)
          .where(
            eq(
              artifactType.id,
              domainData.defaultObjectiveContextArtifactTypeId,
            ),
          )
          .limit(1)
          .then((r) => r[0] || undefined),
      ]);

      return {
        ...domainData,
        defaultObjectiveArtifactType,
        defaultSummaryArtifactType,
        defaultObjectiveActionsArtifactType,
        defaultWorkspaceContextArtifactType,
        defaultObjectiveContextArtifactType,
      };
    },
    [`domain-${id}`],
    {
      tags: [CACHE_TAG, `domain-${id}`],
      revalidate: false,
    },
  )();

/**
 * Fetch domain by workspace ID (leverages getAllDomains cache)
 */
export async function getByWorkspaceId(
  workspaceId: string,
): Promise<DomainWithRelations | null> {
  // Get workspace to find domain ID
  const [ws] = await db
    .select({ domainId: workspace.domainId })
    .from(workspace)
    .where(eq(workspace.id, workspaceId))
    .limit(1);

  if (!ws) return null;

  // Use cached domain fetch
  return await getDomainById(ws.domainId);
}
