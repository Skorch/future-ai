import { NextResponse } from 'next/server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';

import { auth } from '@clerk/nextjs/server';
import { createKnowledgeDocument } from '@/lib/db/knowledge-document';
import { generateDocumentMetadata } from '@/lib/ai/generate-document-metadata';
import { getActiveWorkspace } from '@/lib/workspace/context';
import { getLogger } from '@/lib/logger';
import { revalidateDocumentPaths } from '@/lib/cache/document-cache.server';

const logger = getLogger('FileUploadAPI');

// Only transcript-related file extensions
const ALLOWED_EXTENSIONS = ['.txt', '.md', '.vtt', '.srt', '.transcript'];

// 400KB max file size to ensure ~100k tokens (well under 200k limit)
const MAX_FILE_SIZE = 400 * 1024;

const FileSchema = z.object({
  file: z.instanceof(Blob).refine((file) => file.size <= MAX_FILE_SIZE, {
    message: `File size exceeds maximum allowed (${MAX_FILE_SIZE / 1024}KB)`,
  }),
  filename: z.string(),
});

export async function POST(request: Request) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (request.body === null) {
    return new Response('Request body is empty', { status: 400 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as Blob;
    const objectiveId = formData.get('objectiveId') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    if (!objectiveId) {
      return NextResponse.json(
        { error: 'objectiveId is required' },
        { status: 400 },
      );
    }

    // Get filename from formData since Blob doesn't have name property
    const filename = (formData.get('file') as File).name;
    const filenameLower = filename.toLowerCase();

    // Validate file extension
    const hasValidExtension = ALLOWED_EXTENSIONS.some((ext) =>
      filenameLower.endsWith(ext),
    );

    if (!hasValidExtension) {
      return NextResponse.json(
        {
          error: `Unsupported file type. Allowed extensions: ${ALLOWED_EXTENSIONS.join(', ')}`,
        },
        { status: 400 },
      );
    }

    // Validate file size and structure
    const validatedFile = FileSchema.safeParse({ file, filename });

    if (!validatedFile.success) {
      const errorMessage = validatedFile.error.errors
        .map((error) => error.message)
        .join(', ');

      return NextResponse.json({ error: errorMessage }, { status: 400 });
    }

    // Read file content as text
    const content = await file.text();

    // Get workspace from cookie/context
    const workspaceId = await getActiveWorkspace(userId);

    // Generate AI metadata (title, type, summary) from Phase 1
    logger.debug('Generating AI metadata for transcript', {
      fileName: filename,
      contentLength: content.length,
      userId: userId,
    });

    const metadata = await generateDocumentMetadata({
      content,
      fileName: filename,
    });

    logger.debug('AI metadata generated', {
      title: metadata.title,
      documentType: metadata.documentType,
      hasSummary: !!metadata.summary,
    });

    // Create transcript as KnowledgeDocument (immutable, searchable)
    const doc = await createKnowledgeDocument(workspaceId, userId, {
      objectiveId,
      title: metadata.title,
      content: content,
      category: 'raw',
      documentType: metadata.documentType,
      metadata: {
        fileName: filename,
        fileSize: file.size,
        uploadedAt: new Date().toISOString(),
        aiSummary: metadata.summary,
      },
    });

    // Revalidate Next.js cache so document pages show the new document
    revalidateDocumentPaths(workspaceId, doc.id);
    revalidatePath(`/workspace/${workspaceId}`);
    revalidatePath(`/workspace/${workspaceId}/objective/${objectiveId}`);

    logger.debug('Created knowledge document', {
      documentId: doc.id,
      title: metadata.title,
      documentType: metadata.documentType,
      fileSize: file.size,
      userId: userId,
      category: 'raw',
      isSearchable: doc.isSearchable,
    });

    // Return document ID with AI-generated metadata
    return NextResponse.json({
      success: true,
      documentId: doc.id,
      fileName: filename,
      title: metadata.title,
      documentType: metadata.documentType,
      // This message appears in the chat and triggers AI processing
      message: `TRANSCRIPT_DOCUMENT: ${doc.id}\nFILENAME: ${filename}`,
    });
  } catch (error) {
    logger.error('File upload error:', error);
    return NextResponse.json(
      { error: 'Failed to process transcript upload' },
      { status: 500 },
    );
  }
}
