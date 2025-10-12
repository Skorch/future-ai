import { z } from 'zod';

/**
 * Document Type System
 *
 * Two parallel type systems for different document categories:
 *
 * RAW_DOCUMENT_TYPES: For uploaded/pasted content (category: 'raw')
 * - Naming: underscore_separated (e.g., 'meeting_notes')
 * - Purpose: Classify source/format of raw documents before AI processing
 *
 * KNOWLEDGE_DOCUMENT_TYPES: For AI-generated summaries (category: 'knowledge')
 * - Naming: hyphen-separated (e.g., 'meeting-analysis')
 * - Purpose: Map to artifact registry types for AI-generated knowledge documents
 *
 * Naming Convention Rationale:
 * - Raw types use underscores for consistency with database enum conventions
 * - Knowledge types use hyphens to match existing artifact registry keys
 */

/**
 * RAW_DOCUMENT_TYPES - For uploaded/pasted content (category: 'raw')
 * These types classify the source/format of raw documents before AI processing
 */
export const RAW_DOCUMENT_TYPES = {
  TRANSCRIPT: 'transcript',
  EMAIL: 'email',
  SLACK: 'slack',
  MEETING_NOTES: 'meeting_notes',
  RESEARCH: 'research',
  OTHER: 'other',
} as const;

export type RawDocumentType =
  (typeof RAW_DOCUMENT_TYPES)[keyof typeof RAW_DOCUMENT_TYPES];

/**
 * KNOWLEDGE_DOCUMENT_TYPES - For AI-generated summaries/analysis (category: 'knowledge')
 * These types map to artifact registry types for AI-generated knowledge documents
 */
export const KNOWLEDGE_DOCUMENT_TYPES = {
  TEXT: 'text',
  MEETING_ANALYSIS: 'meeting-analysis',
  MEETING_AGENDA: 'meeting-agenda',
  MEETING_MINUTES: 'meeting-minutes',
  USE_CASE: 'use-case',
  BUSINESS_REQUIREMENTS: 'business-requirements',
  SALES_CALL_SUMMARY: 'sales-call-summary',
  SALES_STRATEGY: 'sales-strategy',
} as const;

export type KnowledgeDocumentType =
  (typeof KNOWLEDGE_DOCUMENT_TYPES)[keyof typeof KNOWLEDGE_DOCUMENT_TYPES];

/**
 * Combined union type for all document types (stored in DB as TEXT)
 */
export type DocumentType = RawDocumentType | KnowledgeDocumentType;

/**
 * Zod schemas for runtime validation
 */
export const RawDocumentTypeSchema = z.enum([
  'transcript',
  'email',
  'slack',
  'meeting_notes',
  'research',
  'other',
]);

export const KnowledgeDocumentTypeSchema = z.enum([
  'text',
  'meeting-analysis',
  'meeting-agenda',
  'meeting-minutes',
  'use-case',
  'business-requirements',
  'sales-call-summary',
  'sales-strategy',
]);

export const DocumentTypeSchema = z.union([
  RawDocumentTypeSchema,
  KnowledgeDocumentTypeSchema,
]);

/**
 * Type guards
 */
export function isRawDocumentType(value: string): value is RawDocumentType {
  return Object.values(RAW_DOCUMENT_TYPES).includes(value as RawDocumentType);
}

export function isKnowledgeDocumentType(
  value: string,
): value is KnowledgeDocumentType {
  return Object.values(KNOWLEDGE_DOCUMENT_TYPES).includes(
    value as KnowledgeDocumentType,
  );
}

export function isValidDocumentType(value: string): value is DocumentType {
  return isRawDocumentType(value) || isKnowledgeDocumentType(value);
}

/**
 * Display labels for UI
 */
export const RAW_DOCUMENT_TYPE_LABELS: Record<RawDocumentType, string> = {
  transcript: 'Transcript',
  email: 'Email',
  slack: 'Slack Conversation',
  meeting_notes: 'Meeting Notes',
  research: 'Research Document',
  other: 'Other',
};

export const KNOWLEDGE_DOCUMENT_TYPE_LABELS: Record<
  KnowledgeDocumentType,
  string
> = {
  text: 'Text',
  'meeting-analysis': 'Meeting Analysis',
  'meeting-agenda': 'Meeting Agenda',
  'meeting-minutes': 'Meeting Minutes',
  'use-case': 'Use Case',
  'business-requirements': 'Business Requirements',
  'sales-call-summary': 'Sales Call Summary',
  'sales-strategy': 'Sales Strategy',
};

/**
 * Helper to get display label for any document type
 */
export function getDocumentTypeLabel(type: DocumentType): string {
  if (isRawDocumentType(type)) {
    return RAW_DOCUMENT_TYPE_LABELS[type];
  }
  if (isKnowledgeDocumentType(type)) {
    return KNOWLEDGE_DOCUMENT_TYPE_LABELS[type];
  }
  return 'Unknown';
}

/**
 * Metadata Extraction Utilities
 *
 * Functions for safely extracting document type information
 * from untyped database metadata objects
 */

/**
 * Safely extract document type from database metadata
 *
 * Handles untyped metadata objects from the database and returns
 * a validated DocumentType or a safe default.
 *
 * @param metadata - Untyped metadata object from database
 * @returns Valid DocumentType or 'text' as safe default
 *
 * @example
 * const docType = extractDocumentType(objectiveDoc.latestVersion.metadata);
 */
export function extractDocumentType(metadata: unknown): DocumentType {
  if (
    typeof metadata === 'object' &&
    metadata !== null &&
    'documentType' in metadata &&
    typeof metadata.documentType === 'string' &&
    isValidDocumentType(metadata.documentType)
  ) {
    return metadata.documentType;
  }
  return KNOWLEDGE_DOCUMENT_TYPES.TEXT; // Safe default for knowledge documents
}

/**
 * Safely extract raw document type from database metadata
 *
 * Specifically for raw documents (category: 'raw') where we need
 * to ensure we get a RawDocumentType for summary generation.
 *
 * @param metadata - Untyped metadata object from database
 * @returns Valid RawDocumentType or 'other' as safe default
 *
 * @example
 * const rawType = extractRawDocumentType(rawDoc.metadata);
 * const prompt = buildSummaryPromptWithContent(rawType, content);
 */
export function extractRawDocumentType(metadata: unknown): RawDocumentType {
  if (
    typeof metadata === 'object' &&
    metadata !== null &&
    'documentType' in metadata &&
    typeof metadata.documentType === 'string' &&
    isRawDocumentType(metadata.documentType)
  ) {
    return metadata.documentType;
  }
  return RAW_DOCUMENT_TYPES.OTHER; // Safe default for raw documents
}
