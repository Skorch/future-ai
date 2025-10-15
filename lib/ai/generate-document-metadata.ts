import { generateObject } from 'ai';
import { z } from 'zod';
import { myProvider } from '@/lib/ai/providers';
import {
  RAW_DOCUMENT_TYPES,
  RawDocumentTypeSchema,
  type RawDocumentType,
} from '@/lib/db/types/document-types';
import { logger } from '@/lib/logger';
import { KNOWLEDGE_DOCUMENT_METADATA_SYSTEM_PROMPT } from '@/lib/ai/prompts/title-metadata-generation';

/**
 * AI-generated metadata for raw documents
 */
export interface DocumentMetadata {
  title: string;
  documentType: RawDocumentType;
  summary?: string;
}

/**
 * Options for generating document metadata
 */
export interface GenerateDocumentMetadataOptions {
  content: string;
  fileName?: string;
  maxTitleLength?: number;
}

/**
 * Zod schema for AI output structure validation
 */
const DocumentMetadataSchema = z.object({
  title: z.string().max(80),
  documentType: RawDocumentTypeSchema,
  summary: z.string().max(200).optional(),
});

/**
 * Generate AI-powered metadata for raw documents
 *
 * Uses Claude Haiku to analyze content and classify document type,
 * generate descriptive title, and optionally create a brief summary.
 *
 * If AI generation fails, falls back to safe defaults using filename
 * or generic values. All failures are logged as errors for monitoring.
 *
 * @param options - Content, filename, and configuration
 * @returns DocumentMetadata with title, type, and optional summary
 */
export async function generateDocumentMetadata({
  content,
  fileName,
  maxTitleLength = 80,
}: GenerateDocumentMetadataOptions): Promise<DocumentMetadata> {
  try {
    const { object } = await generateObject({
      model: myProvider.languageModel('title-model'), // claude-3-5-haiku-latest
      mode: 'json',
      schema: DocumentMetadataSchema,
      system: KNOWLEDGE_DOCUMENT_METADATA_SYSTEM_PROMPT(maxTitleLength),
      prompt: `Analyze this document and provide metadata:

${content}${fileName ? `\n\nOriginal filename: ${fileName}` : ''}`,
      temperature: 0.3, // Low temperature for consistent classification
    });

    return object;
  } catch (error) {
    // Log error for production monitoring
    logger.error('AI metadata generation failed:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      contentLength: content.length,
      hasFileName: !!fileName,
    });

    // Return safe defaults following [date] - [type] - [purpose] format
    const fallbackTitle = fileName
      ? `undated - other - ${fileName.replace(/\.[^/.]+$/, '')}`.slice(
          0,
          maxTitleLength,
        )
      : 'undated - other - document';

    return {
      title: fallbackTitle,
      documentType: RAW_DOCUMENT_TYPES.OTHER,
      summary: undefined,
    };
  }
}
