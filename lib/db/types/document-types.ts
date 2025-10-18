/**
 * Document Type Definitions
 *
 * Separates document types into two categories:
 * 1. Raw Documents - Uploaded/imported content (transcripts, emails, etc.)
 * 2. Knowledge Documents - AI-generated artifacts (meeting analysis, requirements, etc.)
 */

import { z } from 'zod';

/**
 * Raw Document Types - User-uploaded content
 *
 * These represent documents imported or uploaded by users.
 * Used for classification during upload and metadata generation.
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
 * Knowledge Document Types - AI-generated artifacts
 *
 * These are created by the AI through various document generation tools.
 * Each has specific prompts and structure defined in lib/artifacts/.
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
 * Union of all document types
 */
export type DocumentType = RawDocumentType | KnowledgeDocumentType;

/**
 * Zod Schemas for validation
 */
export const RawDocumentTypeSchema = z.enum([
  RAW_DOCUMENT_TYPES.TRANSCRIPT,
  RAW_DOCUMENT_TYPES.EMAIL,
  RAW_DOCUMENT_TYPES.SLACK,
  RAW_DOCUMENT_TYPES.MEETING_NOTES,
  RAW_DOCUMENT_TYPES.RESEARCH,
  RAW_DOCUMENT_TYPES.OTHER,
]);

export const KnowledgeDocumentTypeSchema = z.enum([
  KNOWLEDGE_DOCUMENT_TYPES.TEXT,
  KNOWLEDGE_DOCUMENT_TYPES.MEETING_ANALYSIS,
  KNOWLEDGE_DOCUMENT_TYPES.MEETING_AGENDA,
  KNOWLEDGE_DOCUMENT_TYPES.MEETING_MINUTES,
  KNOWLEDGE_DOCUMENT_TYPES.USE_CASE,
  KNOWLEDGE_DOCUMENT_TYPES.BUSINESS_REQUIREMENTS,
  KNOWLEDGE_DOCUMENT_TYPES.SALES_CALL_SUMMARY,
  KNOWLEDGE_DOCUMENT_TYPES.SALES_STRATEGY,
]);

export const DocumentTypeSchema = z.union([
  RawDocumentTypeSchema,
  KnowledgeDocumentTypeSchema,
]);

/**
 * Type Guards
 */
export function isRawDocumentType(type: string): type is RawDocumentType {
  return Object.values(RAW_DOCUMENT_TYPES).includes(type as RawDocumentType);
}

export function isKnowledgeDocumentType(
  type: string,
): type is KnowledgeDocumentType {
  return Object.values(KNOWLEDGE_DOCUMENT_TYPES).includes(
    type as KnowledgeDocumentType,
  );
}

export function isValidDocumentType(type: string): type is DocumentType {
  return isRawDocumentType(type) || isKnowledgeDocumentType(type);
}

/**
 * Display Labels for UI
 */
export const RAW_DOCUMENT_TYPE_LABELS: Record<RawDocumentType, string> = {
  [RAW_DOCUMENT_TYPES.TRANSCRIPT]: 'Transcript',
  [RAW_DOCUMENT_TYPES.EMAIL]: 'Email',
  [RAW_DOCUMENT_TYPES.SLACK]: 'Slack Conversation',
  [RAW_DOCUMENT_TYPES.MEETING_NOTES]: 'Meeting Notes',
  [RAW_DOCUMENT_TYPES.RESEARCH]: 'Research Document',
  [RAW_DOCUMENT_TYPES.OTHER]: 'Other',
};

export const KNOWLEDGE_DOCUMENT_TYPE_LABELS: Record<
  KnowledgeDocumentType,
  string
> = {
  [KNOWLEDGE_DOCUMENT_TYPES.TEXT]: 'Text',
  [KNOWLEDGE_DOCUMENT_TYPES.MEETING_ANALYSIS]: 'Meeting Analysis',
  [KNOWLEDGE_DOCUMENT_TYPES.MEETING_AGENDA]: 'Meeting Agenda',
  [KNOWLEDGE_DOCUMENT_TYPES.MEETING_MINUTES]: 'Meeting Minutes',
  [KNOWLEDGE_DOCUMENT_TYPES.USE_CASE]: 'Use Case',
  [KNOWLEDGE_DOCUMENT_TYPES.BUSINESS_REQUIREMENTS]: 'Business Requirements',
  [KNOWLEDGE_DOCUMENT_TYPES.SALES_CALL_SUMMARY]: 'Sales Call Summary',
  [KNOWLEDGE_DOCUMENT_TYPES.SALES_STRATEGY]: 'Sales Strategy',
};

/**
 * Get human-readable label for any document type
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
