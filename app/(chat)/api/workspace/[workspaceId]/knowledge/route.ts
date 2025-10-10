import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import {
  getKnowledgeByWorkspaceId,
  createKnowledgeDocument,
} from '@/lib/db/knowledge-document';
import { getWorkspaceById } from '@/lib/workspace/queries';
import { getLogger } from '@/lib/logger';
import { ChatSDKError } from '@/lib/errors';

const logger = getLogger('WorkspaceKnowledgeAPI');

export async function GET(
  request: Request,
  props: { params: Promise<{ workspaceId: string }> },
) {
  const params = await props.params;
  const { workspaceId } = params;
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Verify workspace ownership
    const workspace = await getWorkspaceById(workspaceId, userId);
    if (!workspace) {
      return NextResponse.json(
        { error: 'Workspace not found' },
        { status: 404 },
      );
    }

    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category') as 'knowledge' | 'raw' | null;

    const documents = await getKnowledgeByWorkspaceId(
      workspaceId,
      category || undefined,
    );
    return NextResponse.json({ documents });
  } catch (error) {
    logger.error('Failed to get knowledge documents:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

/**
 * POST /api/workspace/[workspaceId]/knowledge
 * Create a new knowledge document
 */
export async function POST(
  request: Request,
  props: { params: Promise<{ workspaceId: string }> },
) {
  const params = await props.params;
  const { workspaceId } = params;
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Verify workspace ownership
    const workspace = await getWorkspaceById(workspaceId, userId);
    if (!workspace) {
      return NextResponse.json(
        { error: 'Workspace not found' },
        { status: 404 },
      );
    }

    const body = await request.json();
    const { objectiveId, title, content, category, documentType, metadata } =
      body;

    // Validate required fields
    if (!title || !content || !category || !documentType) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 },
      );
    }

    if (!['knowledge', 'raw'].includes(category)) {
      return NextResponse.json({ error: 'Invalid category' }, { status: 400 });
    }

    const document = await createKnowledgeDocument(workspaceId, userId, {
      objectiveId,
      title,
      content,
      category,
      documentType,
      metadata,
    });

    return NextResponse.json({ document }, { status: 201 });
  } catch (error) {
    logger.error('Failed to create knowledge document:', error);

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
