import { toggleDocumentSearchableAction } from '@/lib/workspace/document-actions';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ workspaceId: string; id: string }> },
) {
  const { workspaceId, id } = await params;

  try {
    const body = await request.json();
    const { isSearchable } = body;

    if (typeof isSearchable !== 'boolean') {
      return Response.json(
        { error: 'isSearchable must be a boolean' },
        { status: 400 },
      );
    }

    // Note: New toggle function just toggles, doesn't SET to specific value
    // This maintains backward API compat by toggling
    const result = await toggleDocumentSearchableAction(id, workspaceId);

    return Response.json(result);
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to toggle searchable',
      },
      { status: 500 },
    );
  }
}
