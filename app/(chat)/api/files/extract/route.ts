import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/app/(auth)/auth';
import { extractFileContent } from '@/lib/utils/file-content-extractor';

const ExtractRequestSchema = z.object({
  url: z.string().url(),
  contentType: z.string(),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const validated = ExtractRequestSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { error: 'Invalid request parameters' },
        { status: 400 },
      );
    }

    const { url, contentType } = validated.data;
    const result = await extractFileContent(url, contentType);

    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Extraction failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
