import { auth } from '@clerk/nextjs/server';
import { deleteWorkspaceAction } from '@/lib/workspace/actions';
import { getLogger } from '@/lib/logger';

const logger = getLogger('WorkspaceAPI');

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ workspaceId: string }> },
) {
  const { userId } = await auth();
  const { workspaceId } = await params;

  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await deleteWorkspaceAction(workspaceId);
    return Response.json({ success: true });
  } catch (error) {
    logger.error('Failed to delete workspace:', error);
    return Response.json(
      {
        error: 'Failed to delete workspace',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
