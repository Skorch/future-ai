import { auth } from '@clerk/nextjs/server';
import {
  updateVersionContent,
  getLatestVersion,
} from '@/lib/db/objective-document';
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
    const { content, metadata, versionId } = body;

    if (!content || typeof content !== 'string') {
      return Response.json(
        { error: 'Content is required and must be a string' },
        { status: 400 },
      );
    }

    logger.debug('Updating objective document content:', {
      documentId: id,
      workspaceId,
      versionId: versionId || 'using latest',
    });

    // Use provided versionId, or fall back to latest version
    let targetVersionId = versionId;
    if (!targetVersionId) {
      const latestVersion = await getLatestVersion(id);
      if (!latestVersion) {
        return Response.json(
          { error: 'No version found for this document' },
          { status: 404 },
        );
      }
      targetVersionId = latestVersion.id;
    }

    // Update version content (in-place update, maintains "one chat = one version")
    await updateVersionContent(targetVersionId, content, metadata);

    logger.debug('Document content updated:', {
      documentId: id,
      versionId: targetVersionId,
    });

    return Response.json({
      versionId: targetVersionId,
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
