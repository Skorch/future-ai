import { z } from 'zod';

export const ExtractionResultSchema = z.object({
  content: z.string(),
  metadata: z.object({
    contentType: z.string(),
    extractedAt: z.string(),
    characterCount: z.number(),
    format: z.enum(['text', 'vtt', 'markdown', 'pdf', 'json']).optional(),
  }),
});

export type ExtractionResult = z.infer<typeof ExtractionResultSchema>;

export async function extractFileContent(
  url: string,
  contentType: string,
): Promise<ExtractionResult> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch file: ${response.statusText}`);
  }

  let content: string;
  let format: ExtractionResult['metadata']['format'];

  // Text-based files
  if (contentType.startsWith('text/') || contentType === 'application/json') {
    content = await response.text();

    // Detect format
    if (contentType === 'text/vtt' || content.includes('WEBVTT')) {
      format = 'vtt';
    } else if (
      contentType === 'text/markdown' ||
      contentType.includes('markdown')
    ) {
      format = 'markdown';
    } else if (contentType === 'application/json') {
      format = 'json';
    } else {
      format = 'text';
    }
  }
  // PDF files (simplified - in production use pdf-parse or similar)
  else if (contentType === 'application/pdf') {
    // For now, return a placeholder. Real implementation would use pdf-parse
    throw new Error(
      'PDF extraction not yet implemented. Please convert to text format.',
    );
  } else {
    throw new Error(`Cannot extract text from ${contentType} files`);
  }

  return {
    content,
    metadata: {
      contentType,
      extractedAt: new Date().toISOString(),
      characterCount: content.length,
      format,
    },
  };
}

export function canExtractContent(contentType: string): boolean {
  return (
    contentType.startsWith('text/') ||
    contentType === 'application/json' ||
    contentType === 'application/pdf'
  );
}
