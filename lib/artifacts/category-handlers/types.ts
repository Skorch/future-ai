import type { UIMessageStreamWriter } from 'ai';
import type { ArtifactType, artifactTypeCategoryEnum } from '@/lib/db/schema';
import type { ChatMessage } from '@/lib/types';

/**
 * Context provided to category handlers during artifact generation
 *
 * This interface encapsulates all the information a category handler needs
 * to generate artifact content, including the current state, user instructions,
 * source materials, and streaming capabilities.
 */
export interface GenerationContext {
  /**
   * CRITICAL: The current version content of the artifact being updated
   * For new artifacts, this will be undefined
   * For updates, this contains the full markdown content of the current version
   */
  currentVersion?: string;

  /**
   * User-provided or tool-provided instruction for generation
   * This describes what the user wants to achieve with this generation
   */
  instruction?: string;

  /**
   * IDs of source documents to use for context
   * These are typically raw materials (transcripts, emails, notes)
   */
  sourceDocumentIds?: string[];

  /**
   * IDs of knowledge documents to incorporate
   * These are typically processed/summarized knowledge artifacts
   */
  knowledgeDocIds?: string[];

  /**
   * Optional data stream for real-time updates to the UI
   * Handlers can use this to stream progress, reasoning, or partial results
   * When undefined, handlers will accumulate and return the complete result
   */
  dataStream?: UIMessageStreamWriter<ChatMessage>;

  /**
   * The workspace context for this generation
   * Used for database queries and access control
   */
  workspaceId: string;

  /**
   * Optional chat ID to inherit conversation context
   * When provided, the handler can fetch chat history for contextual awareness
   */
  chatId?: string;

  /**
   * Optional objective context
   * When generating artifacts within an objective scope
   */
  objectiveId?: string;

  /**
   * User session for authentication and authorization
   * Contains the user ID for database operations and display name for prompts
   */
  session: {
    user: {
      id: string;
      firstName: string | null;
      lastName: string | null;
    };
  };
}

/**
 * Category-specific handler interface
 *
 * Each artifact category (objective, summary, objectiveActions, context)
 * must implement this interface to provide generation logic.
 */
export interface CategoryHandler {
  /**
   * The category this handler is responsible for
   * Must match one of the enum values from the database schema
   */
  readonly category: (typeof artifactTypeCategoryEnum.enumValues)[number];

  /**
   * Generate artifact content based on the artifact type configuration
   *
   * @param artifactType - The artifact type configuration (prompts, templates, etc.)
   * @param context - All contextual information needed for generation
   * @returns The generated artifact content as markdown
   */
  generate(
    artifactType: ArtifactType,
    context: GenerationContext,
  ): Promise<string>;
}
