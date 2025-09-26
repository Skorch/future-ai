import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { cleanupTranscriptsFromMetadata } from '@/lib/db/cleanup-metadata';

export async function POST() {
  try {
    // Check authentication
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[API] Starting metadata cleanup for user:', userId);

    // Run the cleanup
    const result = await cleanupTranscriptsFromMetadata();

    return NextResponse.json({
      success: true,
      ...result,
      message: `Successfully cleaned ${result.cleanedDocuments} documents`,
    });
  } catch (error) {
    console.error('[API] Cleanup failed:', error);
    return NextResponse.json(
      { error: 'Cleanup failed', details: String(error) },
      { status: 500 },
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message:
      'POST to this endpoint to clean transcripts from document metadata',
    warning: 'This will modify your database. Make sure you have a backup.',
  });
}
