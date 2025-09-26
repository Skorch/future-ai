import { auth } from '@/app/(auth)/auth';
import { getWorkspacesByUserId } from '@/lib/workspace/queries';

export async function GET() {
  const session = await auth();

  if (!session?.user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const workspaces = await getWorkspacesByUserId(session.user.id);
    return Response.json(workspaces);
  } catch (error) {
    console.error('Failed to fetch workspaces:', error);
    return Response.json(
      { error: 'Failed to fetch workspaces' },
      { status: 500 },
    );
  }
}
