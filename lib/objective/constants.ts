/**
 * Maximum character limit for objective goal and actions fields
 * These fields are stored in ObjectiveDocumentVersion table
 */
export const OBJECTIVE_FIELD_MAX_LENGTH = 5000;

/**
 * Character count threshold for displaying warnings in editors
 * Warning appears when content exceeds this percentage of max length
 */
export const OBJECTIVE_FIELD_WARNING_THRESHOLD = 0.95; // 95% of max (4750 chars)
