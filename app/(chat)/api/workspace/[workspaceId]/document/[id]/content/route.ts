import { auth } from '@clerk/nextjs/server';
import { updateObjectiveDocumentContent } from '@/lib/db/objective-document';
import { ChatSDKError } from '@/lib/errors';
import { getLogger } from '@/lib/logger';

const logger = getLogger('DocumentContentAPI');

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ workspaceId: string; id: string }> },
) {
  const { workspaceId, id } = await params;
  const { userId } = await auth();

  if (!userId) {
    return new ChatSDKError('unauthorized:document').toResponse();
  }

  try {
    const body = await request.json();
    const { content, chatId, metadata } = body;

    if (!content || typeof content !== 'string') {
      return Response.json(
        { error: 'Content is required and must be a string' },
        { status: 400 },
      );
    }

    logger.debug('Updating objective document content:', {
      documentId: id,
      workspaceId,
      hasChatId: !!chatId,
    });

    // Create new version (chatId can be null for direct edits)
    const newVersion = await updateObjectiveDocumentContent(
      id,
      chatId || '', // Empty string for direct edits (not from chat)
      userId,
      content,
      metadata,
    );

    logger.debug('Document content updated:', {
      documentId: id,
      versionNumber: newVersion.versionNumber,
    });

    return Response.json({
      version: newVersion,
      success: true,
    });
  } catch (error) {
    logger.error('Failed to update document content:', error);

    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }

    return Response.json(
      {
        error:
          error instanceof Error ? error.message : 'Failed to update document',
      },
      { status: 500 },
    );
  }
}
