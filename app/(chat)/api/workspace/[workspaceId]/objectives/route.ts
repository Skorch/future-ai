import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import {
  getObjectivesByWorkspaceId,
  createObjective,
} from '@/lib/db/objective';
import { getWorkspaceById } from '@/lib/workspace/queries';
import { getLogger } from '@/lib/logger';

const logger = getLogger('WorkspaceObjectivesAPI');

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
    const includePublished = searchParams.get('includePublished') === 'true';

    const objectives = await getObjectivesByWorkspaceId(
      workspaceId,
      includePublished,
    );
    return NextResponse.json(objectives);
  } catch (error) {
    logger.error('Failed to get objectives:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

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
    const body = await request.json();
    const { title, description } = body;

    // Verify workspace ownership
    const workspace = await getWorkspaceById(workspaceId, userId);
    if (!workspace) {
      return NextResponse.json(
        { error: 'Workspace not found' },
        { status: 404 },
      );
    }

    const objective = await createObjective(workspaceId, userId, {
      title,
      description,
    });

    return NextResponse.json(objective, { status: 201 });
  } catch (error) {
    logger.error('Failed to create objective:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
