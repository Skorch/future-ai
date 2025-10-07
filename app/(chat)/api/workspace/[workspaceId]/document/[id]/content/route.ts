import { updatePublishedDocumentAction } from '@/lib/workspace/document-actions';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ workspaceId: string; id: string }> },
) {
  const { workspaceId, id } = await params;

  try {
    const body = await request.json();
    const { content } = body;

    if (!content || typeof content !== 'string') {
      return Response.json(
        { error: 'Content is required and must be a string' },
        { status: 400 },
      );
    }

    // Use updatePublishedDocumentAction for /document/[id]/edit route
    // This creates a new version and immediately publishes it
    // (Different from artifact editor which creates drafts)
    const result = await updatePublishedDocumentAction(
      id, // documentEnvelopeId
      content,
      workspaceId,
    );

    return Response.json(result);
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : 'Failed to update document',
      },
      { status: 500 },
    );
  }
}
