import { auth } from '@clerk/nextjs/server';
import { getWorkspaceDocumentsPaginated } from '@/lib/db/documents';
import { ChatSDKError } from '@/lib/errors';
import { getLogger } from '@/lib/logger';

const logger = getLogger('DocumentListAPI');

export async function GET(
  request: Request,
  props: { params: Promise<{ workspaceId: string }> },
) {
  const params = await props.params;
  const { workspaceId } = params;

  const { userId } = await auth();

  if (!userId) {
    logger.error('Unauthorized - no session');
    return new ChatSDKError('unauthorized:document').toResponse();
  }

  try {
    // Parse query parameters for pagination/filtering
    const { searchParams } = new URL(request.url);
    const limit = Number.parseInt(searchParams.get('limit') || '50', 10);
    const cursor = searchParams.get('cursor') || undefined;
    const search = searchParams.get('search') || undefined;
    const type = searchParams.get('type') || undefined;
    const sortBy =
      (searchParams.get('sortBy') as 'created' | 'title') || 'created';
    const sortOrder =
      (searchParams.get('sortOrder') as 'asc' | 'desc') || 'desc';

    logger.debug('GET request for workspace documents:', {
      workspaceId,
      limit,
      cursor,
      search,
      type,
      sortBy,
      sortOrder,
    });

    const result = await getWorkspaceDocumentsPaginated({
      workspaceId,
      limit,
      cursor,
      search,
      type,
      sortBy,
      sortOrder,
    });

    logger.debug('Documents fetched:', {
      count: result.documents.length,
      totalCount: result.totalCount,
      hasMore: result.hasMore,
      workspaceId,
    });

    return Response.json(result, { status: 200 });
  } catch (error) {
    logger.error('Failed to fetch workspace documents:', {
      workspaceId,
      error,
    });
    return new ChatSDKError(
      'bad_request:database',
      'Failed to fetch documents',
    ).toResponse();
  }
}
