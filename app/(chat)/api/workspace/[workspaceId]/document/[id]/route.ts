import { auth } from '@clerk/nextjs/server';
import type { ArtifactKind } from '@/components/artifact';
import {
  getDocumentWithVersions,
  getAllVersionsForDocument,
} from '@/lib/db/documents';
import type { DocumentVersion } from '@/lib/db/schema';
import { ChatSDKError } from '@/lib/errors';
import { getLogger } from '@/lib/logger';

const logger = getLogger('DocumentAPI');

export async function GET(
  request: Request,
  props: { params: Promise<{ workspaceId: string; id: string }> },
) {
  const params = await props.params;
  const { workspaceId, id } = params;

  logger.debug('GET request for document:', id);

  const { userId } = await auth();

  if (!userId) {
    logger.error('Unauthorized - no session');
    return new ChatSDKError('unauthorized:document').toResponse();
  }

  logger.debug('Fetching document with versions for ID:', id);
  const docWithVersions = await getDocumentWithVersions(id);

  if (
    !docWithVersions ||
    docWithVersions.envelope.workspaceId !== workspaceId
  ) {
    logger.error('Document not found or access denied');
    return new ChatSDKError('not_found:document').toResponse();
  }

  // Get all versions for backward compatibility with old UI
  const allVersions = await getAllVersionsForDocument(id);

  logger.debug('Document fetched:', {
    envelopeId: id,
    versionCount: allVersions.length,
    hasDraft: !!docWithVersions.currentDraft,
    hasPublished: !!docWithVersions.currentPublished,
  });

  // Return versions in old format for backward compatibility
  const documents = allVersions.map((version: DocumentVersion) => ({
    id: docWithVersions.envelope.id, // Keep envelope ID
    versionId: version.id,
    title: docWithVersions.envelope.title,
    content: version.content,
    kind: version.kind,
    createdAt: version.createdAt,
    metadata: version.metadata,
    workspaceId: docWithVersions.envelope.workspaceId,
  }));

  logger.debug('Returning documents successfully');
  return Response.json(documents, { status: 200 });
}

export async function POST(
  request: Request,
  props: { params: Promise<{ workspaceId: string; id: string }> },
) {
  const params = await props.params;
  const { workspaceId, id } = params;

  const { userId } = await auth();

  if (!userId) {
    return new ChatSDKError('unauthorized:document').toResponse();
  }

  const {
    content,
    title,
    kind,
  }: { content: string; title: string; kind: ArtifactKind } =
    await request.json();

  // Get existing document to verify access
  const docWithVersions = await getDocumentWithVersions(id);

  if (
    !docWithVersions ||
    docWithVersions.envelope.workspaceId !== workspaceId
  ) {
    return new ChatSDKError('not_found:document').toResponse();
  }

  // Update title if changed
  if (title !== docWithVersions.envelope.title) {
    // TODO: Implement updateDocumentTitle function
    logger.warn('Title update not yet implemented for envelope schema');
  }

  // Create new draft version with updated content
  // Note: This maintains backward compat with old versioning UI that creates new versions on each save
  // TODO: Implement createNewDraftVersion or use updateDraft based on UI requirements
  logger.warn(
    'POST /document/[id] not fully implemented for new schema - needs createNewDraftVersion',
  );

  // For now, return success with existing data
  return Response.json(
    {
      id: docWithVersions.envelope.id,
      versionId: docWithVersions.currentDraft?.id,
      title: docWithVersions.envelope.title,
      content: docWithVersions.currentDraft?.content,
      kind: docWithVersions.currentDraft?.kind,
    },
    { status: 200 },
  );
}

export async function DELETE(
  request: Request,
  props: { params: Promise<{ workspaceId: string; id: string }> },
) {
  const params = await props.params;
  const { workspaceId, id } = params;
  const { searchParams } = new URL(request.url);
  const timestamp = searchParams.get('timestamp');

  if (!timestamp) {
    return new ChatSDKError(
      'bad_request:api',
      'Parameter timestamp is required.',
    ).toResponse();
  }

  const { userId } = await auth();

  if (!userId) {
    return new ChatSDKError('unauthorized:document').toResponse();
  }

  // Get existing document to verify access
  const docWithVersions = await getDocumentWithVersions(id);

  if (
    !docWithVersions ||
    docWithVersions.envelope.workspaceId !== workspaceId
  ) {
    return new ChatSDKError('not_found:document').toResponse();
  }

  // TODO: Implement deleteVersionsAfterTimestamp for new schema
  // This was used by the old version rollback UI
  logger.warn(
    'DELETE /document/[id] with timestamp not yet implemented for new schema',
  );

  // Return empty array for now (no versions deleted)
  return Response.json([], { status: 200 });
}
