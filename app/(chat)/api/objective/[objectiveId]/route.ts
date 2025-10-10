import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import {
  getObjectiveById,
  updateObjective,
  deleteObjective,
  publishObjective,
  unpublishObjective,
} from '@/lib/db/objective';
import { getLogger } from '@/lib/logger';

const logger = getLogger('ObjectiveAPI');

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

    return NextResponse.json(objective);
  } catch (error) {
    logger.error('Failed to get objective:', error);
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
    const { title, description, status } = body;

    // If status is being changed to 'published', use publishObjective
    if (status === 'published') {
      await publishObjective(objectiveId, userId);
    } else if (status === 'open') {
      await unpublishObjective(objectiveId, userId);
    } else if (title || description) {
      await updateObjective(objectiveId, userId, { title, description });
    }

    const updated = await getObjectiveById(objectiveId, userId);
    return NextResponse.json(updated);
  } catch (error) {
    logger.error('Failed to update objective:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

export async function DELETE(
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
    await deleteObjective(objectiveId, userId);
    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Failed to delete objective:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
