import { z } from 'zod';
import type { DocumentType } from './index';

/**
 * Metadata schemas for each document type.
 * These schemas define the fields that can be provided when creating documents.
 */
export const DOCUMENT_METADATA_SCHEMAS: Record<
  DocumentType,
  // biome-ignore lint/suspicious/noExplicitAny: Zod schema types require generic any
  z.ZodObject<any>
> = {
  'sales-analysis': z.object({
    callDate: z.string().default('Not specified'),
    participants: z.array(z.string()).default([]),
    dealName: z.string().default('Not specified'),
    prospectCompany: z.string().default('Not specified'),
  }),
  'sales-strategy': z.object({
    dealName: z.string().default('Not specified'),
    prospectCompany: z.string().default('Not specified'),
    specificQuestion: z.string().optional(),
  }),
  'meeting-analysis': z.object({
    meetingDate: z.string().default(new Date().toISOString().split('T')[0]),
    participants: z.array(z.string()).default([]),
  }),
  'meeting-minutes': z.object({
    meetingDate: z.string().default(new Date().toISOString().split('T')[0]),
    participants: z.array(z.string()).default([]),
    emailRecipients: z.array(z.string()).default([]),
  }),
  'meeting-agenda': z.object({
    meetingDate: z.string().default(new Date().toISOString().split('T')[0]),
    participants: z.array(z.string()).default([]),
    duration: z.string().optional(),
  }),
  'business-requirements': z.object({
    projectName: z.string().default('Project'),
    stakeholders: z.array(z.string()).default([]),
  }),
  'use-case': z.object({
    systemName: z.string().default('System'),
    actors: z.array(z.string()).default([]),
  }),
  text: z.object({}), // No specific metadata for text documents
};

/**
 * Get the metadata schema for a specific document type.
 */
export function getMetadataSchema(docType: DocumentType) {
  return DOCUMENT_METADATA_SCHEMAS[docType] || z.object({});
}

/**
 * Get default values for a document type's metadata.
 */
// biome-ignore lint/suspicious/noExplicitAny: Metadata values can be of any type
export function getDefaultMetadata(docType: DocumentType): Record<string, any> {
  const schema = getMetadataSchema(docType);
  try {
    return schema.parse({});
  } catch {
    return {};
  }
}

/**
 * Get human-readable labels for metadata fields.
 */
export const METADATA_FIELD_LABELS: Record<string, string> = {
  callDate: 'Call Date',
  participants: 'Participants',
  dealName: 'Deal Name',
  prospectCompany: 'Prospect Company',
  meetingDate: 'Meeting Date',
  emailRecipients: 'Email Recipients',
  duration: 'Duration',
  projectName: 'Project Name',
  stakeholders: 'Stakeholders',
  systemName: 'System Name',
  actors: 'Actors',
};
