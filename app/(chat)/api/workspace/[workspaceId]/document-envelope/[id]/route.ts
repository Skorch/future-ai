import { auth } from '@clerk/nextjs/server';
import { getObjectiveDocumentById } from '@/lib/db/objective-document';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ workspaceId: string; id: string }> },
) {
  const { userId } = await auth();
  const { workspaceId, id } = await params;

  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const doc = await getObjectiveDocumentById(id);

    if (!doc || doc.document.workspaceId !== workspaceId) {
      return Response.json({ error: 'Not found' }, { status: 404 });
    }

    return Response.json(doc);
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to fetch document envelope',
      },
      { status: 500 },
    );
  }
}
