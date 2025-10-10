import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import {
  getKnowledgeDocumentById,
  updateKnowledgeDocument,
  deleteKnowledgeDocument,
} from '@/lib/db/knowledge-document';
import { getLogger } from '@/lib/logger';
import { ChatSDKError } from '@/lib/errors';

const logger = getLogger('KnowledgeDetailAPI');

/**
 * GET /api/workspace/[workspaceId]/knowledge/[id]
 * Get a single knowledge document
 */
export async function GET(
  _request: Request,
  props: { params: Promise<{ workspaceId: string; id: string }> },
) {
  const params = await props.params;
  const { id } = params;
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const document = await getKnowledgeDocumentById(id, userId);

    if (!document) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 },
      );
    }

    return NextResponse.json({ document });
  } catch (error) {
    logger.error('Failed to get knowledge document:', error);

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

/**
 * PATCH /api/workspace/[workspaceId]/knowledge/[id]
 * Update a knowledge document
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
    const { title, content, metadata, isSearchable } = body;

    const document = await updateKnowledgeDocument(id, userId, {
      title,
      content,
      metadata,
      isSearchable,
    });

    return NextResponse.json({ document });
  } catch (error) {
    logger.error('Failed to update knowledge document:', error);

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

/**
 * DELETE /api/workspace/[workspaceId]/knowledge/[id]
 * Delete a knowledge document
 */
export async function DELETE(
  _request: Request,
  props: { params: Promise<{ workspaceId: string; id: string }> },
) {
  const params = await props.params;
  const { id } = params;
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await deleteKnowledgeDocument(id, userId);
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    logger.error('Failed to delete knowledge document:', error);

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
