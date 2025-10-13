import { auth } from '@clerk/nextjs/server';
import { getAllObjectiveDocumentsByWorkspaceId } from '@/lib/db/objective-document';
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
    const search = searchParams.get('search') || undefined;

    logger.debug('GET request for workspace objective documents:', {
      workspaceId,
      limit,
      search,
    });

    // Get all objective documents for workspace
    const results = await getAllObjectiveDocumentsByWorkspaceId(
      workspaceId,
      userId,
    );

    // Filter by search if provided
    let filteredResults = results;
    if (search) {
      const searchLower = search.toLowerCase();
      filteredResults = results.filter(
        (r) =>
          r.document.title.toLowerCase().includes(searchLower) ||
          r.latestVersion?.content.toLowerCase().includes(searchLower),
      );
    }

    // Apply limit
    const paginatedResults = filteredResults.slice(0, limit);

    // Transform to expected format
    const documents = paginatedResults.map((r) => ({
      id: r.document.id,
      title: r.document.title,
      workspaceId: r.document.workspaceId,
      createdAt: r.document.createdAt,
      updatedAt: r.document.updatedAt,
      createdByUserId: r.document.createdByUserId,
      // Include latest version data
      latestVersion: r.latestVersion
        ? {
            id: r.latestVersion.id,
            content: r.latestVersion.content,
            createdAt: r.latestVersion.createdAt,
            metadata: r.latestVersion.metadata,
          }
        : null,
      // Include linked objective
      objective: r.objective
        ? {
            id: r.objective.id,
            title: r.objective.title,
            status: r.objective.status,
          }
        : null,
    }));

    logger.debug('Objective documents fetched:', {
      count: documents.length,
      total: filteredResults.length,
      workspaceId,
    });

    return Response.json(
      {
        documents,
        total: filteredResults.length,
        hasMore: filteredResults.length > limit,
      },
      { status: 200 },
    );
  } catch (error) {
    logger.error('Failed to fetch workspace objective documents:', {
      workspaceId,
      error,
    });
    return new ChatSDKError(
      'bad_request:database',
      'Failed to fetch documents',
    ).toResponse();
  }
}
