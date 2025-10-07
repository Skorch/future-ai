import { getLogger } from '@/lib/logger';
import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

const logger = getLogger('AdminCleanup');

/**
 * DEPRECATED ENDPOINT
 * This endpoint used cleanup-metadata which relied on the old Document table.
 * The Document table has been removed in favor of DocumentEnvelope/DocumentVersion schema.
 * This endpoint is kept for API compatibility but returns an error.
 */

export async function POST() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    logger.error('[API] Deprecated endpoint called:', { userId });

    return NextResponse.json(
      {
        error: 'DEPRECATED',
        message:
          'This endpoint is deprecated. The old Document table has been removed. See lib/db/cleanup-metadata-deprecated.ts for historical reference.',
      },
      { status: 410 },
    ); // 410 Gone
  } catch (error) {
    logger.error('[API] Error in deprecated endpoint:', error);
    return NextResponse.json(
      { error: 'Endpoint deprecated', details: String(error) },
      { status: 410 },
    );
  }
}

export async function GET() {
  return NextResponse.json(
    {
      error: 'DEPRECATED',
      message:
        'This endpoint is deprecated. The old Document table has been removed.',
    },
    { status: 410 },
  );
}
