import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { updateKnowledgeDocument } from '@/lib/db/knowledge-document';
import { getLogger } from '@/lib/logger';
import { ChatSDKError } from '@/lib/errors';

const logger = getLogger('KnowledgeSearchableAPI');

/**
 * PATCH /api/workspace/[workspaceId]/knowledge/[id]/searchable
 * Toggle searchable status on a knowledge document
 */
export async function PATCH(
  request: Request,
  props: { params: Promise<{ workspaceId: string; id: string }> },
) {
  const params = await props.params;
  const { id } = params;
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { isSearchable } = body;

    if (typeof isSearchable !== 'boolean') {
      return NextResponse.json(
        { error: 'isSearchable must be a boolean' },
        { status: 400 },
      );
    }

    const document = await updateKnowledgeDocument(id, {
      isSearchable,
    });

    return NextResponse.json({ document });
  } catch (error) {
    logger.error(
      'Failed to update knowledge document searchable status:',
      error,
    );

    if (error instanceof ChatSDKError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode },
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
