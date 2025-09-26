import { auth } from '@/app/(auth)/auth';
import { getWorkspaceById } from '@/lib/workspace/queries';
import { getChatsByWorkspaceAndUser, db } from '@/lib/db/queries';
import { document } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ workspaceId: string }> },
) {
  const session = await auth();
  const { workspaceId } = await params;

  if (!session?.user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Verify workspace belongs to user
    const workspace = await getWorkspaceById(workspaceId, session.user.id);
    if (!workspace) {
      return Response.json({ error: 'Workspace not found' }, { status: 404 });
    }

    // Get chat count
    const chats = await getChatsByWorkspaceAndUser({
      workspaceId: workspaceId,
      userId: session.user.id,
      limit: 1000, // Get all for count
      startingAfter: null,
      endingBefore: null,
    });

    // Get document count
    const documents = await db
      .select()
      .from(document)
      .where(eq(document.workspaceId, workspaceId));

    return Response.json({
      chatCount: chats.length,
      documentCount: documents.length,
    });
  } catch (error) {
    console.error('Failed to get workspace stats:', error);
    return Response.json(
      { error: 'Failed to get workspace stats' },
      { status: 500 },
    );
  }
}
