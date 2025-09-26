import { auth } from '@clerk/nextjs/server';
import { getWorkspacesByUserId } from '@/lib/workspace/queries';
import { getLogger } from '@/lib/logger';

const logger = getLogger('WorkspaceAPI');

export async function GET() {
  const { userId } = await auth();

  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const workspaces = await getWorkspacesByUserId(userId);
    return Response.json(workspaces);
  } catch (error) {
    logger.error('Failed to fetch workspaces:', error);
    return Response.json(
      { error: 'Failed to fetch workspaces' },
      { status: 500 },
    );
  }
}
