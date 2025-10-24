import 'server-only';

import { revalidateTag } from 'next/cache';
import { db } from '@/lib/db/queries';
import { playbook, playbookStep, playbookDomain, domain } from '../../schema';
import { eq, asc } from 'drizzle-orm';

// Cache tags for invalidation
const CACHE_TAG = 'playbooks';

/**
 * Admin-specific playbook type with full domain and step details
 */
export interface AdminPlaybook {
  id: string;
  name: string;
  description: string | null;
  whenToUse: string | null;
  domains: Array<{
    id: string;
    title: string;
  }>;
  steps: Array<{
    id: string;
    sequence: number;
    instruction: string;
    toolCall: string | null;
    condition: string | null;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Fetch all playbooks with their associated domains and steps
 * Uses efficient LEFT JOIN pattern to avoid N+1 queries
 */
export async function getAllPlaybooksWithDomains(): Promise<AdminPlaybook[]> {
  // Fetch playbooks with domains via LEFT JOIN
  const playbooksWithDomains = await db
    .select({
      playbookId: playbook.id,
      playbookName: playbook.name,
      playbookDescription: playbook.description,
      playbookWhenToUse: playbook.whenToUse,
      playbookCreatedAt: playbook.createdAt,
      playbookUpdatedAt: playbook.updatedAt,
      domainId: domain.id,
      domainTitle: domain.title,
    })
    .from(playbook)
    .leftJoin(playbookDomain, eq(playbookDomain.playbookId, playbook.id))
    .leftJoin(domain, eq(domain.id, playbookDomain.domainId))
    .orderBy(playbook.name);

  // Fetch all steps separately (more efficient than joining to avoid cartesian product)
  const allSteps = await db
    .select({
      playbookId: playbookStep.playbookId,
      id: playbookStep.id,
      sequence: playbookStep.sequence,
      instruction: playbookStep.instruction,
      toolCall: playbookStep.toolCall,
      condition: playbookStep.condition,
    })
    .from(playbookStep)
    .orderBy(asc(playbookStep.sequence));

  // Group steps by playbookId for efficient lookup
  const stepsByPlaybook = allSteps.reduce(
    (acc, step) => {
      if (!acc[step.playbookId]) {
        acc[step.playbookId] = [];
      }
      acc[step.playbookId].push({
        id: step.id,
        sequence: step.sequence,
        instruction: step.instruction,
        toolCall: step.toolCall,
        condition: step.condition,
      });
      return acc;
    },
    {} as Record<string, AdminPlaybook['steps']>,
  );

  // Transform flat rows into nested AdminPlaybook structure
  const playbooksMap = playbooksWithDomains.reduce(
    (acc, row) => {
      const playbookId = row.playbookId;

      // Initialize playbook if not seen before
      if (!acc[playbookId]) {
        acc[playbookId] = {
          id: playbookId,
          name: row.playbookName,
          description: row.playbookDescription,
          whenToUse: row.playbookWhenToUse,
          domains: [],
          steps: stepsByPlaybook[playbookId] || [],
          createdAt: row.playbookCreatedAt,
          updatedAt: row.playbookUpdatedAt,
        };
      }

      // Add domain if it exists (LEFT JOIN may produce null domains)
      if (row.domainId && row.domainTitle) {
        acc[playbookId].domains.push({
          id: row.domainId,
          title: row.domainTitle,
        });
      }

      return acc;
    },
    {} as Record<string, AdminPlaybook>,
  );

  return Object.values(playbooksMap);
}

/**
 * Fetch a single playbook with its domains and steps
 * Uses LEFT JOIN pattern for efficient querying
 */
export async function getPlaybookWithDomains(
  id: string,
): Promise<AdminPlaybook | null> {
  // Fetch playbook with domains via LEFT JOIN
  const playbookRows = await db
    .select({
      playbookId: playbook.id,
      playbookName: playbook.name,
      playbookDescription: playbook.description,
      playbookWhenToUse: playbook.whenToUse,
      playbookCreatedAt: playbook.createdAt,
      playbookUpdatedAt: playbook.updatedAt,
      domainId: domain.id,
      domainTitle: domain.title,
    })
    .from(playbook)
    .leftJoin(playbookDomain, eq(playbookDomain.playbookId, playbook.id))
    .leftJoin(domain, eq(domain.id, playbookDomain.domainId))
    .where(eq(playbook.id, id));

  if (playbookRows.length === 0) {
    return null;
  }

  // Fetch steps for this playbook
  const steps = await db
    .select({
      id: playbookStep.id,
      sequence: playbookStep.sequence,
      instruction: playbookStep.instruction,
      toolCall: playbookStep.toolCall,
      condition: playbookStep.condition,
    })
    .from(playbookStep)
    .where(eq(playbookStep.playbookId, id))
    .orderBy(asc(playbookStep.sequence));

  // Transform rows into single AdminPlaybook object
  const firstRow = playbookRows[0];
  const adminPlaybook: AdminPlaybook = {
    id: firstRow.playbookId,
    name: firstRow.playbookName,
    description: firstRow.playbookDescription,
    whenToUse: firstRow.playbookWhenToUse,
    domains: playbookRows
      .filter(
        (row): row is typeof row & { domainId: string; domainTitle: string } =>
          typeof row.domainId === 'string' &&
          typeof row.domainTitle === 'string',
      )
      .map((row) => ({
        id: row.domainId,
        title: row.domainTitle,
      })),
    steps,
    createdAt: firstRow.playbookCreatedAt,
    updatedAt: firstRow.playbookUpdatedAt,
  };

  return adminPlaybook;
}

/**
 * Create a new playbook with domains and steps
 * Uses transaction to ensure atomicity
 */
export async function createPlaybook(data: {
  name: string;
  description?: string;
  whenToUse?: string;
  domainIds: string[]; // Domain UUIDs
  steps: {
    sequence: number;
    instruction: string;
    toolCall?: string;
    condition?: string;
  }[];
}): Promise<AdminPlaybook> {
  const result = await db.transaction(async (tx) => {
    // Insert playbook
    const [newPlaybook] = await tx
      .insert(playbook)
      .values({
        name: data.name,
        description: data.description,
        whenToUse: data.whenToUse,
      })
      .returning();

    // Insert domain associations via junction table
    if (data.domainIds.length > 0) {
      await tx.insert(playbookDomain).values(
        data.domainIds.map((domainId) => ({
          playbookId: newPlaybook.id,
          domainId,
        })),
      );
    }

    // Insert steps
    if (data.steps.length > 0) {
      await tx.insert(playbookStep).values(
        data.steps.map((step) => ({
          playbookId: newPlaybook.id,
          sequence: step.sequence,
          instruction: step.instruction,
          toolCall: step.toolCall,
          condition: step.condition,
        })),
      );
    }

    return newPlaybook.id;
  });

  // Invalidate cache
  revalidateTag(CACHE_TAG);

  // Fetch and return complete playbook with domains and steps
  const adminPlaybook = await getPlaybookWithDomains(result);
  if (!adminPlaybook) {
    throw new Error('Failed to create playbook');
  }

  return adminPlaybook;
}

/**
 * Update an existing playbook with optional domains and steps
 * Uses transaction to ensure atomicity
 */
export async function updatePlaybook(
  id: string,
  data: {
    name?: string;
    description?: string;
    whenToUse?: string;
    domainIds?: string[]; // Domain UUIDs
    steps?: {
      sequence: number;
      instruction: string;
      toolCall?: string;
      condition?: string;
    }[];
  },
): Promise<AdminPlaybook | null> {
  const result = await db.transaction(async (tx) => {
    // Update playbook
    const [updated] = await tx
      .update(playbook)
      .set({
        ...(data.name && { name: data.name }),
        ...(data.description !== undefined && {
          description: data.description,
        }),
        ...(data.whenToUse !== undefined && { whenToUse: data.whenToUse }),
        updatedAt: new Date(),
      })
      .where(eq(playbook.id, id))
      .returning();

    if (!updated) return null;

    // Update domain associations if provided
    if (data.domainIds) {
      // Delete existing domain associations
      await tx.delete(playbookDomain).where(eq(playbookDomain.playbookId, id));

      // Insert new domain associations
      if (data.domainIds.length > 0) {
        await tx.insert(playbookDomain).values(
          data.domainIds.map((domainId) => ({
            playbookId: id,
            domainId,
          })),
        );
      }
    }

    // Update steps if provided
    if (data.steps) {
      // Delete existing steps
      await tx.delete(playbookStep).where(eq(playbookStep.playbookId, id));

      // Insert new steps
      if (data.steps.length > 0) {
        await tx.insert(playbookStep).values(
          data.steps.map((step) => ({
            playbookId: id,
            sequence: step.sequence,
            instruction: step.instruction,
            toolCall: step.toolCall,
            condition: step.condition,
          })),
        );
      }
    }

    return updated.id;
  });

  if (!result) {
    return null;
  }

  // Invalidate cache
  revalidateTag(CACHE_TAG);
  revalidateTag(`playbook-${id}`);

  // Fetch and return complete playbook with domains and steps
  return await getPlaybookWithDomains(id);
}

/**
 * Clone a playbook with all steps and domain associations
 * Uses transaction to ensure atomicity
 */
export async function clonePlaybook(
  sourceId: string,
  newName: string,
): Promise<AdminPlaybook> {
  const result = await db.transaction(async (tx) => {
    // Load source playbook with all its data
    const sourcePlaybook = await getPlaybookWithDomains(sourceId);
    if (!sourcePlaybook) {
      throw new Error(`Source playbook with id ${sourceId} not found`);
    }

    // Create new playbook with copied metadata
    const [newPlaybook] = await tx
      .insert(playbook)
      .values({
        name: newName,
        description: sourcePlaybook.description,
        whenToUse: sourcePlaybook.whenToUse,
      })
      .returning();

    // Copy domain associations
    if (sourcePlaybook.domains.length > 0) {
      await tx.insert(playbookDomain).values(
        sourcePlaybook.domains.map((domain) => ({
          playbookId: newPlaybook.id,
          domainId: domain.id,
        })),
      );
    }

    // Copy steps with same sequence and instructions
    if (sourcePlaybook.steps.length > 0) {
      await tx.insert(playbookStep).values(
        sourcePlaybook.steps.map((step) => ({
          playbookId: newPlaybook.id,
          sequence: step.sequence,
          instruction: step.instruction,
          toolCall: step.toolCall,
          condition: step.condition,
        })),
      );
    }

    return newPlaybook.id;
  });

  // Invalidate cache
  revalidateTag(CACHE_TAG);

  // Fetch and return complete cloned playbook with domains and steps
  const clonedPlaybook = await getPlaybookWithDomains(result);
  if (!clonedPlaybook) {
    throw new Error('Failed to clone playbook');
  }

  return clonedPlaybook;
}

/**
 * Delete a playbook and all associated data
 * Cascade deletes will handle junction table and steps
 */
export async function deletePlaybook(id: string): Promise<boolean> {
  const result = await db
    .delete(playbook)
    .where(eq(playbook.id, id))
    .returning();

  // Invalidate cache
  revalidateTag(CACHE_TAG);
  revalidateTag(`playbook-${id}`);

  return result.length > 0;
}
