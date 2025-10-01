import { NextResponse } from 'next/server';
import { z } from 'zod';

import { auth } from '@clerk/nextjs/server';
import { saveDocument } from '@/lib/db/documents';
import { generateUUID } from '@/lib/utils';
import { getActiveWorkspace } from '@/lib/workspace/context';
import { getLogger } from '@/lib/logger';

const logger = getLogger('FileUploadAPI');

// Only transcript-related file extensions
const ALLOWED_EXTENSIONS = ['.txt', '.md', '.vtt', '.srt', '.transcript'];

// 10MB max file size for transcripts
const MAX_FILE_SIZE = 10 * 1024 * 1024;

const FileSchema = z.object({
  file: z.instanceof(Blob).refine((file) => file.size <= MAX_FILE_SIZE, {
    message: `File size exceeds maximum allowed (${MAX_FILE_SIZE / 1024 / 1024}MB)`,
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

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
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

    // Generate document ID
    const documentId = generateUUID();

    logger.debug('Attempting to save document:', {
      id: documentId,
      // title removed - may contain sensitive filename
      contentLength: content.length,
      kind: 'text',
      userId: userId,
      metadata: {
        documentType: 'transcript',
        // fileName removed - may contain sensitive info
        fileSize: file.size,
        uploadedAt: new Date().toISOString(),
      },
    });

    // Get workspace from cookie/context
    const workspaceId = await getActiveWorkspace(userId);

    // Create transcript document directly in database
    await saveDocument({
      id: documentId,
      title: filename,
      content: content,
      kind: 'text',
      userId: userId,
      workspaceId,
      metadata: {
        documentType: 'transcript',
        fileName: filename,
        fileSize: file.size,
        uploadedAt: new Date().toISOString(),
      },
    });

    logger.debug('Created transcript document', {
      documentId,
      // fileName removed - may contain sensitive info
      fileSize: file.size,
      userId: userId,
    });

    // Return document ID with explicit transcript marker for chat
    return NextResponse.json({
      success: true,
      documentId,
      fileName: filename,
      // This message appears in the chat and triggers AI processing
      message: `TRANSCRIPT_DOCUMENT: ${documentId}\nFILENAME: ${filename}`,
    });
  } catch (error) {
    logger.error('File upload error:', error);
    return NextResponse.json(
      { error: 'Failed to process transcript upload' },
      { status: 500 },
    );
  }
}
