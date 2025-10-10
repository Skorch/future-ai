import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import {
  getKnowledgeByObjectiveId,
  createKnowledgeDocument,
} from '@/lib/db/knowledge-document';
import { getObjectiveById } from '@/lib/db/objective';
import { getLogger } from '@/lib/logger';

const logger = getLogger('ObjectiveKnowledgeAPI');

export async function GET(
  request: Request,
  props: { params: Promise<{ objectiveId: string }> },
) {
  const params = await props.params;
  const { objectiveId } = params;
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const objective = await getObjectiveById(objectiveId, userId);
    if (!objective) {
      return NextResponse.json(
        { error: 'Objective not found' },
        { status: 404 },
      );
    }

    const documents = await getKnowledgeByObjectiveId(objectiveId);
    return NextResponse.json(documents);
  } catch (error) {
    logger.error('Failed to get knowledge documents:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

export async function POST(
  request: Request,
  props: { params: Promise<{ objectiveId: string }> },
) {
  const params = await props.params;
  const { objectiveId } = params;
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { title, content, category, documentType, metadata } = body;

    const objective = await getObjectiveById(objectiveId, userId);
    if (!objective) {
      return NextResponse.json(
        { error: 'Objective not found' },
        { status: 404 },
      );
    }

    const document = await createKnowledgeDocument(
      objective.workspaceId,
      userId,
      {
        objectiveId,
        title,
        content,
        category,
        documentType,
        metadata,
      },
    );

    return NextResponse.json(document, { status: 201 });
  } catch (error) {
    logger.error('Failed to create knowledge document:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
