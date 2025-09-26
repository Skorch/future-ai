import { auth } from '@/app/(auth)/auth';
import { deleteWorkspaceAction } from '@/lib/workspace/actions';

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ workspaceId: string }> },
) {
  const session = await auth();
  const { workspaceId } = await params;

  if (!session?.user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await deleteWorkspaceAction(workspaceId);
    return Response.json({ success: true });
  } catch (error) {
    console.error('Failed to delete workspace:', error);
    return Response.json(
      {
        error: 'Failed to delete workspace',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
