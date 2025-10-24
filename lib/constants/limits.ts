/**
 * Shared character limits for context fields
 * Centralized to ensure consistency across domain defaults and workspace contexts
 */
export const WORKSPACE_CONTEXT_MAX_LENGTH = Number.parseInt(
  process.env.WORKSPACE_CONTEXT_MAX_LENGTH || '5000',
);
