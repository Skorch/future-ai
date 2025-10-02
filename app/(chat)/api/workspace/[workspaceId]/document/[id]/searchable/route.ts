import { toggleDocumentSearchableAction } from '@/lib/workspace/document-actions';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ workspaceId: string; id: string }> }
) {
  const { workspaceId, id } = await params;

  try {
    const body = await request.json();
    const { isSearchable } = body;

    if (typeof isSearchable !== 'boolean') {
      return Response.json(
        { error: 'isSearchable must be a boolean' },
        { status: 400 }
      );
    }

    const result = await toggleDocumentSearchableAction(
      id,
      workspaceId,
      isSearchable
    );

    return Response.json(result);
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to toggle searchable',
      },
      { status: 500 }
    );
  }
}
