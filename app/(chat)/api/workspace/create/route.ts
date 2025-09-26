import { auth } from '@clerk/nextjs/server';
import { createWorkspaceAction } from '@/lib/workspace/actions';
import { getLogger } from '@/lib/logger';

const logger = getLogger('WorkspaceCreateAPI');

export async function POST(request: Request) {
  const { userId } = await auth();

  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const workspace = await createWorkspaceAction(formData);

    return Response.json(workspace);
  } catch (error) {
    logger.error('Failed to create workspace:', error);
    return Response.json(
      {
        error: 'Failed to create workspace',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
