/**
 * Builder Type Definitions
 * Shared interfaces for all builder categories
 */

import type {
  DomainWithRelations,
  Workspace,
  Objective,
} from '@/lib/db/schema';

/**
 * Category-specific interface for Document builders
 * Each builder generates a complete system prompt for document generation
 */
export interface DocumentBuilder {
  generate(
    domain: DomainWithRelations,
    workspace: Workspace | null,
    objective: Objective | null,
  ): string;
}

/**
 * Category-specific interface for Knowledge builders
 * Each builder generates a complete system prompt for knowledge summarization
 */
export interface KnowledgeBuilder {
  generate(
    domain: DomainWithRelations,
    workspace: Workspace | null,
    objective: Objective | null,
  ): string;
}
