import { auth } from '@clerk/nextjs/server';
import { getObjectiveDocumentById } from '@/lib/db/objective-document';
import { ChatSDKError } from '@/lib/errors';
import { getLogger } from '@/lib/logger';

const logger = getLogger('DocumentAPI');

export async function GET(
  request: Request,
  props: { params: Promise<{ workspaceId: string; id: string }> },
) {
  const params = await props.params;
  const { workspaceId, id } = params;

  // Parse query params
  const { searchParams } = new URL(request.url);
  const versionId = searchParams.get('versionId');

  logger.debug('GET request for objective document:', {
    documentId: id,
    versionId: versionId || 'latest',
  });

  const { userId } = await auth();

  if (!userId) {
    logger.error('Unauthorized - no session');
    return new ChatSDKError('unauthorized:document').toResponse();
  }

  try {
    const docWithVersions = await getObjectiveDocumentById(id);

    if (
      !docWithVersions ||
      docWithVersions.document.workspaceId !== workspaceId
    ) {
      logger.error('Objective document not found or access denied');
      return new ChatSDKError('not_found:document').toResponse();
    }

    // If specific version requested, filter to that version
    if (versionId) {
      const version = docWithVersions.versions.find((v) => v.id === versionId);

      if (!version) {
        logger.error('Version not found', { versionId, documentId: id });
        return new ChatSDKError(
          'not_found:document',
          'Requested document version not found',
        ).toResponse();
      }

      logger.debug('Returning specific version:', {
        documentId: id,
        versionId,
      });

      return Response.json([version], { status: 200 });
    }

    // No versionId: return all versions (current behavior)
    logger.debug('Returning all versions:', {
      documentId: id,
      versionCount: docWithVersions.versions.length,
      hasLatest: !!docWithVersions.latestVersion,
    });

    return Response.json(docWithVersions.versions, { status: 200 });
  } catch (error) {
    logger.error('Failed to get objective document:', error);
    return new ChatSDKError(
      'bad_request:database',
      'Failed to get document',
    ).toResponse();
  }
}

// POST and DELETE removed - use /content route for updates and direct DELETE for document removal
