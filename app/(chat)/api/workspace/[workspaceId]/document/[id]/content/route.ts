import { updateDocumentContentAction } from '@/lib/workspace/document-actions';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ workspaceId: string; id: string }> }
) {
  const { workspaceId, id } = await params;

  try {
    const body = await request.json();
    const { content, title } = body;

    if (!content || typeof content !== 'string') {
      return Response.json(
        { error: 'Content is required and must be a string' },
        { status: 400 }
      );
    }

    if (title !== undefined && typeof title !== 'string') {
      return Response.json(
        { error: 'Title must be a string' },
        { status: 400 }
      );
    }

    const result = await updateDocumentContentAction(
      id,
      workspaceId,
      content,
      title
    );

    return Response.json(result);
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : 'Failed to update document',
      },
      { status: 500 }
    );
  }
}
