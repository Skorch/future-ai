import { auth } from '@/app/(auth)/auth';
import { createWorkspaceAction } from '@/lib/workspace/actions';

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const workspace = await createWorkspaceAction(formData);

    return Response.json(workspace);
  } catch (error) {
    console.error('Failed to create workspace:', error);
    return Response.json(
      {
        error: 'Failed to create workspace',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
