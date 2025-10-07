import { auth } from '@clerk/nextjs/server';
import { getWorkspaceById } from '@/lib/workspace/queries';
import { getChatsByWorkspaceAndUser } from '@/lib/db/queries';
import { getPublishedDocuments } from '@/lib/db/documents';
import { getLogger } from '@/lib/logger';

const logger = getLogger('WorkspaceStatsAPI');

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ workspaceId: string }> },
) {
  const { userId } = await auth();
  const { workspaceId } = await params;

  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Verify workspace belongs to user
    const workspace = await getWorkspaceById(workspaceId, userId);
    if (!workspace) {
      return Response.json({ error: 'Workspace not found' }, { status: 404 });
    }

    // Get chat count
    const chats = await getChatsByWorkspaceAndUser({
      workspaceId: workspaceId,
      userId: userId,
      limit: 1000, // Get all for count
      startingAfter: null,
      endingBefore: null,
    });

    // Get published document count (using new envelope/version schema)
    const documents = await getPublishedDocuments(workspaceId);

    return Response.json({
      chatCount: chats.length,
      documentCount: documents.length,
    });
  } catch (error) {
    logger.error('Failed to get workspace stats:', error);
    return Response.json(
      { error: 'Failed to get workspace stats' },
      { status: 500 },
    );
  }
}
