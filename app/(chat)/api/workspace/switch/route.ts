import { auth } from '@clerk/nextjs/server';
import { switchWorkspaceAction } from '@/lib/workspace/actions';
import { z } from 'zod';
import { getLogger } from '@/lib/logger';

const logger = getLogger('WorkspaceSwitchAPI');

const switchSchema = z.object({
  workspaceId: z.string().uuid(),
});

export async function POST(request: Request) {
  const { userId } = await auth();

  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { workspaceId } = switchSchema.parse(body);

    await switchWorkspaceAction(workspaceId);

    return Response.json({ success: true });
  } catch (error) {
    logger.error('Failed to switch workspace:', error);
    if (error instanceof z.ZodError) {
      return Response.json({ error: 'Invalid workspace ID' }, { status: 400 });
    }
    return Response.json(
      { error: 'Failed to switch workspace' },
      { status: 500 },
    );
  }
}
