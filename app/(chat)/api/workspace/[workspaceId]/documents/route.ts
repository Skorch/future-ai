import { auth } from '@clerk/nextjs/server';
import type { ArtifactKind } from '@/components/artifact';
import {
  deleteDocumentsByIdAfterTimestamp,
  getDocumentsById,
  saveDocument,
} from '@/lib/db/queries';
import { ChatSDKError } from '@/lib/errors';

export async function GET(
  request: Request,
  props: { params: Promise<{ workspaceId: string }> },
) {
  const params = await props.params;
  const { workspaceId } = params;
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

  const { userId } = await auth();

  if (!userId) {
    console.log('[Document API] Error: Unauthorized - no session');
    return new ChatSDKError('unauthorized:document').toResponse();
  }

  console.log('[Document API] Fetching documents for ID:', id);
  const documents = await getDocumentsById({ id, workspaceId });

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

  console.log('[Document API] Returning documents successfully');
  return Response.json(documents, { status: 200 });
}

export async function POST(
  request: Request,
  props: { params: Promise<{ workspaceId: string }> },
) {
  const params = await props.params;
  const { workspaceId } = params;
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return new ChatSDKError(
      'bad_request:api',
      'Parameter id is required.',
    ).toResponse();
  }

  const { userId } = await auth();

  if (!userId) {
    return new ChatSDKError('not_found:document').toResponse();
  }

  const {
    content,
    title,
    kind,
  }: { content: string; title: string; kind: ArtifactKind } =
    await request.json();

  const documents = await getDocumentsById({ id, workspaceId });

  if (documents.length > 0) {
    const [document] = documents;
  }

  const document = await saveDocument({
    id,
    content,
    title,
    kind,
    userId: userId,
    workspaceId,
  });

  return Response.json(document, { status: 200 });
}

export async function DELETE(
  request: Request,
  props: { params: Promise<{ workspaceId: string }> },
) {
  const params = await props.params;
  const { workspaceId } = params;
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

  const { userId } = await auth();

  if (!userId) {
    return new ChatSDKError('unauthorized:document').toResponse();
  }

  const documents = await getDocumentsById({ id, workspaceId });

  const [document] = documents;

  const documentsDeleted = await deleteDocumentsByIdAfterTimestamp({
    id,
    timestamp: new Date(timestamp),
  });

  return Response.json(documentsDeleted, { status: 200 });
}
