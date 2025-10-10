import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import {
  getKnowledgeDocumentById,
  updateKnowledgeDocument,
  deleteKnowledgeDocument,
} from '@/lib/db/knowledge-document';
import { getLogger } from '@/lib/logger';

const logger = getLogger('KnowledgeAPI');

export async function GET(
  request: Request,
  props: { params: Promise<{ knowledgeId: string }> },
) {
  const params = await props.params;
  const { knowledgeId } = params;
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const document = await getKnowledgeDocumentById(knowledgeId, userId);

    if (!document) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 },
      );
    }

    return NextResponse.json(document);
  } catch (error) {
    logger.error('Failed to get knowledge document:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

export async function PUT(
  request: Request,
  props: { params: Promise<{ knowledgeId: string }> },
) {
  const params = await props.params;
  const { knowledgeId } = params;
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { title, content, metadata, isSearchable } = body;

    await updateKnowledgeDocument(knowledgeId, userId, {
      title,
      content,
      metadata,
      isSearchable,
    });

    const updated = await getKnowledgeDocumentById(knowledgeId, userId);
    return NextResponse.json(updated);
  } catch (error) {
    logger.error('Failed to update knowledge document:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: Request,
  props: { params: Promise<{ knowledgeId: string }> },
) {
  const params = await props.params;
  const { knowledgeId } = params;
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await deleteKnowledgeDocument(knowledgeId, userId);
    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Failed to delete knowledge document:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
