import { auth } from '@clerk/nextjs/server';
import { getWorkspacesByUserId } from '@/lib/workspace/queries';

export async function GET() {
  const { userId } = await auth();

  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const workspaces = await getWorkspacesByUserId(userId);
    return Response.json(workspaces);
  } catch (error) {
    console.error('Failed to fetch workspaces:', error);
    return Response.json(
      { error: 'Failed to fetch workspaces' },
      { status: 500 },
    );
  }
}
