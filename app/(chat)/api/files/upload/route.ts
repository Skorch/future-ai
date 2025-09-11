import { put } from '@vercel/blob';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { auth } from '@/app/(auth)/auth';
import { generateStoragePath } from '@/lib/utils/file-storage';

const ALLOWED_FILE_TYPES = [
  // Images (existing)
  'image/jpeg',
  'image/png',
  // Text formats
  'text/plain',
  'text/vtt',
  'text/markdown',
  'text/csv',
  // Documents
  'application/pdf',
  'application/json',
];

const MAX_FILE_SIZE: Record<string, number> = {
  'image/': 5 * 1024 * 1024, // 5MB for images
  'text/': 10 * 1024 * 1024, // 10MB for text
  'application/': 20 * 1024 * 1024, // 20MB for documents
};

const FileSchema = z.object({
  file: z
    .instanceof(Blob)
    .refine(
      (file) => {
        const category = Object.keys(MAX_FILE_SIZE).find((cat) =>
          file.type.startsWith(cat),
        );
        const maxSize = category ? MAX_FILE_SIZE[category] : 5 * 1024 * 1024;
        return file.size <= maxSize;
      },
      {
        message: 'File size exceeds maximum allowed',
      },
    )
    .refine((file) => ALLOWED_FILE_TYPES.includes(file.type), {
      message:
        'File type not supported. Supported types: images (JPEG, PNG), text (TXT, VTT, MD), documents (PDF, JSON)',
    }),
});

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (request.body === null) {
    return new Response('Request body is empty', { status: 400 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as Blob;
    const chatId = formData.get('chatId') as string;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const validatedFile = FileSchema.safeParse({ file });

    if (!validatedFile.success) {
      const errorMessage = validatedFile.error.errors
        .map((error) => error.message)
        .join(', ');

      return NextResponse.json({ error: errorMessage }, { status: 400 });
    }

    // Get filename from formData since Blob doesn't have name property
    const filename = (formData.get('file') as File).name;

    // Generate storage path: user_id/chat_id/file_id.ext
    const storagePath = generateStoragePath({
      userId: session.user.id,
      chatId: chatId || 'default',
      filename,
    });

    const fileBuffer = await file.arrayBuffer();

    try {
      const data = await put(storagePath, fileBuffer, {
        access: 'public',
        contentType: file.type,
      });

      return NextResponse.json({
        url: data.url,
        pathname: storagePath,
        contentType: file.type,
        extractable:
          file.type.startsWith('text/') ||
          file.type === 'application/json' ||
          file.type === 'application/pdf',
      });
    } catch (error) {
      console.error('[File Upload] Error:', error);
      return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
    }
  } catch (error) {
    console.error('[File Upload] Error:', error);
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 },
    );
  }
}
