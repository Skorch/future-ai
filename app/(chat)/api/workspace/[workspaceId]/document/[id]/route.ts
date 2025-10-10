import { auth } from '@clerk/nextjs/server';
import { getObjectiveDocumentById } from '@/lib/db/objective-document';
import { ChatSDKError } from '@/lib/errors';
import { getLogger } from '@/lib/logger';

const logger = getLogger('DocumentAPI');

export async function GET(
  _request: Request,
  props: { params: Promise<{ workspaceId: string; id: string }> },
) {
  const params = await props.params;
  const { workspaceId, id } = params;

  logger.debug('GET request for objective document:', id);

  const { userId } = await auth();

  if (!userId) {
    logger.error('Unauthorized - no session');
    return new ChatSDKError('unauthorized:document').toResponse();
  }

  try {
    const docWithVersions = await getObjectiveDocumentById(id, userId);

    if (
      !docWithVersions ||
      docWithVersions.document.workspaceId !== workspaceId
    ) {
      logger.error('Document not found or access denied');
      return new ChatSDKError('not_found:document').toResponse();
    }

    logger.debug('Objective document fetched:', {
      documentId: id,
      versionCount: docWithVersions.versions.length,
      hasLatest: !!docWithVersions.latestVersion,
    });

    // Return in format expected by components
    return Response.json(
      {
        document: docWithVersions.document,
        versions: docWithVersions.versions,
        latestVersion: docWithVersions.latestVersion,
      },
      { status: 200 },
    );
  } catch (error) {
    logger.error('Failed to get objective document:', error);
    return new ChatSDKError(
      'bad_request:database',
      'Failed to get document',
    ).toResponse();
  }
}

// POST and DELETE removed - use /content route for updates and direct DELETE for document removal
