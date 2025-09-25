import { auth } from '@/app/(auth)/auth';
import type { ArtifactKind } from '@/components/artifact';
import {
  deleteDocumentsByIdAfterTimestamp,
  getDocumentsById,
  saveDocument,
} from '@/lib/db/queries';
import { ChatSDKError } from '@/lib/errors';
import { getActiveWorkspace } from '@/lib/workspace/context';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  console.log('[Document API] GET request for document:', id);

  if (!id) {
    console.log('[Document API] Error: Missing document ID');
    return new ChatSDKError(
      'bad_request:api',
      'Parameter id is missing',
    ).toResponse();
  }

  const session = await auth();

  if (!session?.user) {
    console.log('[Document API] Error: Unauthorized - no session');
    return new ChatSDKError('unauthorized:document').toResponse();
  }

  console.log('[Document API] Fetching documents for ID:', id);
  const documents = await getDocumentsById({ id });

  console.log('[Document API] Documents fetched:', {
    count: documents.length,
    hasContent: documents.map((d) => ({
      hasContent: !!d.content,
      contentLength: d.content?.length || 0,
      title: d.title,
    })),
  });

  const [document] = documents;

  if (!document) {
    console.log('[Document API] Error: Document not found');
    return new ChatSDKError('not_found:document').toResponse();
  }

  // TODO: Phase 4 - Check if user has access to this workspace
  if (document.createdByUserId !== session.user.id) {
    console.log('[Document API] Error: Forbidden - wrong user');
    return new ChatSDKError('forbidden:document').toResponse();
  }

  console.log('[Document API] Returning documents successfully');
  return Response.json(documents, { status: 200 });
}

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return new ChatSDKError(
      'bad_request:api',
      'Parameter id is required.',
    ).toResponse();
  }

  const session = await auth();

  if (!session?.user) {
    return new ChatSDKError('not_found:document').toResponse();
  }

  const {
    content,
    title,
    kind,
  }: { content: string; title: string; kind: ArtifactKind } =
    await request.json();

  const documents = await getDocumentsById({ id });

  if (documents.length > 0) {
    const [document] = documents;

    // TODO: Phase 4 - Check if user has access to this workspace
    if (document.createdByUserId !== session.user.id) {
      return new ChatSDKError('forbidden:document').toResponse();
    }
  }

  // Get workspace from cookie/context
  const workspaceId = await getActiveWorkspace(session.user.id);

  const document = await saveDocument({
    id,
    content,
    title,
    kind,
    userId: session.user.id,
    workspaceId,
  });

  return Response.json(document, { status: 200 });
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  const timestamp = searchParams.get('timestamp');

  if (!id) {
    return new ChatSDKError(
      'bad_request:api',
      'Parameter id is required.',
    ).toResponse();
  }

  if (!timestamp) {
    return new ChatSDKError(
      'bad_request:api',
      'Parameter timestamp is required.',
    ).toResponse();
  }

  const session = await auth();

  if (!session?.user) {
    return new ChatSDKError('unauthorized:document').toResponse();
  }

  const documents = await getDocumentsById({ id });

  const [document] = documents;

  // TODO: Phase 4 - Check if user has access to this workspace
  if (document.createdByUserId !== session.user.id) {
    return new ChatSDKError('forbidden:document').toResponse();
  }

  const documentsDeleted = await deleteDocumentsByIdAfterTimestamp({
    id,
    timestamp: new Date(timestamp),
  });

  return Response.json(documentsDeleted, { status: 200 });
}
