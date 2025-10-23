import { z } from 'zod';

/**
 * Metadata schemas for each document type.
 * These schemas define the fields that can be provided when creating documents.
 *
 * @deprecated These hardcoded schemas are being replaced by database-driven configuration.
 */
export const DOCUMENT_METADATA_SCHEMAS: Record<
  string,
  // biome-ignore lint/suspicious/noExplicitAny: Zod schema types require generic any
  z.ZodObject<any>
> = {
  'sales-strategy': z.object({
    dealName: z.string().default('Not specified'),
    prospectCompany: z.string().default('Not specified'),
    specificQuestion: z.string().optional(),
  }),
  'business-requirements': z.object({
    projectName: z.string().default('Project'),
    stakeholders: z.array(z.string()).default([]),
  }),
};

/**
 * Get the metadata schema for a specific document type.
 */
export function getMetadataSchema(docType: string) {
  return DOCUMENT_METADATA_SCHEMAS[docType] || z.object({});
}

/**
 * Get default values for a document type's metadata.
 */
// biome-ignore lint/suspicious/noExplicitAny: Metadata values can be of any type
export function getDefaultMetadata(docType: string): Record<string, any> {
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
  dealName: 'Deal Name',
  prospectCompany: 'Prospect Company',
  specificQuestion: 'Specific Question',
  projectName: 'Project Name',
  stakeholders: 'Stakeholders',
};
