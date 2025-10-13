import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import {
  getDocumentByObjectiveId,
  createObjectiveDocument,
  createDocumentVersion,
} from '@/lib/db/objective-document';
import { getObjectiveById } from '@/lib/db/objective';
import { getLogger } from '@/lib/logger';

const logger = getLogger('ObjectiveDocumentAPI');

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
    // Verify user owns objective
    const objective = await getObjectiveById(objectiveId, userId);
    if (!objective) {
      return NextResponse.json(
        { error: 'Objective not found' },
        { status: 404 },
      );
    }

    const result = await getDocumentByObjectiveId(objectiveId);

    if (!result) {
      return NextResponse.json({ document: null, version: null });
    }

    return NextResponse.json({
      document: result.document,
      version: result.latestVersion || null,
    });
  } catch (error) {
    logger.error('Failed to get document:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

export async function PUT(
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
    const { title, content, metadata } = body;

    // Verify user owns objective
    const objective = await getObjectiveById(objectiveId, userId);
    if (!objective) {
      return NextResponse.json(
        { error: 'Objective not found' },
        { status: 404 },
      );
    }

    // Check if document exists
    const existingDoc = await getDocumentByObjectiveId(objectiveId);

    if (!existingDoc) {
      // Create first document + version
      const created = await createObjectiveDocument(
        objectiveId,
        objective.workspaceId,
        userId,
        { title, content },
      );
      return NextResponse.json({
        document: created.document,
        version: created.version,
      });
    } else {
      // Create new version
      await createDocumentVersion(existingDoc.document.id, userId, {
        content,
        metadata,
      });
      // Re-fetch to get latest version
      const updated = await getDocumentByObjectiveId(objectiveId);
      return NextResponse.json({
        document: updated?.document || null,
        version: updated?.latestVersion || null,
      });
    }
  } catch (error) {
    logger.error('Failed to update document:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
