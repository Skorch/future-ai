import { generateObject } from 'ai';
import { z } from 'zod';
import { myProvider } from '@/lib/ai/providers';
import {
  RAW_DOCUMENT_TYPES,
  RawDocumentTypeSchema,
  type RawDocumentType,
} from '@/lib/db/types/document-types';
import { logger } from '@/lib/logger';

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

      system: `You are a document classification assistant. Analyze the provided content and generate:
1. A concise, descriptive title (max ${maxTitleLength} characters)
2. The most appropriate document type from the available categories
3. An optional brief summary (max 200 characters) for substantial content

**Document Type Classification Rules:**

- **transcript**: Meeting recordings, call transcripts, interview transcripts, video captions, verbatim conversations with timestamps or speaker labels
- **email**: Email messages, email threads, correspondence, messages with To/From/Subject headers
- **slack**: Slack messages, DMs, channel conversations, team chat, informal messaging threads
- **meeting_notes**: Written meeting notes, agenda items, action items, structured notes (not verbatim transcripts)
- **research**: Research documents, articles, reports, whitepapers, analysis, studies, technical papers
- **other**: Anything that doesn't clearly fit the above categories

**Title Guidelines:**
- Be specific and descriptive about the content
- Exclude file extensions (.txt, .md, etc.)
- Use sentence case (capitalize first word only)
- Focus on the content topic, not the document format
- Extract key subject matter or purpose

**Summary Guidelines (if content is substantial):**
- One sentence capturing the main topic or purpose
- Max 200 characters
- Omit if content is too short to meaningfully summarize`,

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

    // Return safe defaults
    return {
      title: fileName
        ? fileName.replace(/\.[^/.]+$/, '').slice(0, maxTitleLength)
        : 'Untitled Document',
      documentType: RAW_DOCUMENT_TYPES.OTHER,
      summary: undefined,
    };
  }
}
