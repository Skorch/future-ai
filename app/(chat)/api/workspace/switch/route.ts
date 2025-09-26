import { auth } from '@/app/(auth)/auth';
import { switchWorkspaceAction } from '@/lib/workspace/actions';
import { z } from 'zod';

const switchSchema = z.object({
  workspaceId: z.string().uuid(),
});

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { workspaceId } = switchSchema.parse(body);

    await switchWorkspaceAction(workspaceId);

    return Response.json({ success: true });
  } catch (error) {
    console.error('Failed to switch workspace:', error);
    if (error instanceof z.ZodError) {
      return Response.json({ error: 'Invalid workspace ID' }, { status: 400 });
    }
    return Response.json(
      { error: 'Failed to switch workspace' },
      { status: 500 },
    );
  }
}
