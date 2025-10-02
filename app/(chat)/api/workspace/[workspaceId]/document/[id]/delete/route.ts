import { deleteDocumentAction } from '@/lib/workspace/document-actions';

/**
 * Soft delete endpoint for documents
 * Note: This is separate from the version-control DELETE at /document/[id]
 * which handles deleting document versions after a timestamp
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ workspaceId: string; id: string }> },
) {
  const { workspaceId, id } = await params;

  try {
    const result = await deleteDocumentAction(id, workspaceId);
    return Response.json(result);
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : 'Failed to delete document',
      },
      { status: 500 },
    );
  }
}
