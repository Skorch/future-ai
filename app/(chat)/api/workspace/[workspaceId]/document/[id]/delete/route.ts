import { auth } from '@clerk/nextjs/server';
import { deleteObjectiveDocument } from '@/lib/db/objective-document';
import { ChatSDKError } from '@/lib/errors';
import { getLogger } from '@/lib/logger';

const logger = getLogger('DocumentDeleteAPI');

/**
 * Delete endpoint for objective documents
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ workspaceId: string; id: string }> },
) {
  const { id } = await params;
  const { userId } = await auth();

  if (!userId) {
    return new ChatSDKError('unauthorized:document').toResponse();
  }

  try {
    logger.debug('Deleting objective document:', { documentId: id });

    await deleteObjectiveDocument(id, userId);

    logger.debug('Document deleted successfully:', { documentId: id });

    return Response.json({ success: true }, { status: 200 });
  } catch (error) {
    logger.error('Failed to delete document:', error);

    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }

    return Response.json(
      {
        error:
          error instanceof Error ? error.message : 'Failed to delete document',
      },
      { status: 500 },
    );
  }
}
