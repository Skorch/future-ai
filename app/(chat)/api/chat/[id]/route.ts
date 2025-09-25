import { auth } from '@/app/(auth)/auth';
import { deleteChatById, getChatById } from '@/lib/db/queries';
import { ChatSDKError } from '@/lib/errors';
import { getActiveWorkspace } from '@/lib/workspace/context';

export async function GET(
  request: Request,
  props: { params: Promise<{ id: string }> },
) {
  const params = await props.params;
  const chatId = params.id;
  const session = await auth();

  if (!session?.user) {
    return new ChatSDKError('unauthorized:api').toResponse();
  }

  const workspaceId = await getActiveWorkspace(session.user.id);

  try {
    const chat = await getChatById({ id: chatId, workspaceId });

    if (!chat) {
      return new ChatSDKError('not_found:chat').toResponse();
    }

    return Response.json(chat);
  } catch (error) {
    console.error('Failed to get chat:', error);
    return new ChatSDKError(
      'internal_server_error:chat',
      'Failed to get chat',
    ).toResponse();
  }
}

export async function DELETE(
  request: Request,
  props: { params: Promise<{ id: string }> },
) {
  const params = await props.params;
  const chatId = params.id;
  const session = await auth();

  if (!session?.user) {
    return new ChatSDKError('unauthorized:api').toResponse();
  }

  const workspaceId = await getActiveWorkspace(session.user.id);

  try {
    await deleteChatById({ id: chatId, workspaceId });
    return Response.json({ success: true });
  } catch (error) {
    console.error('Failed to delete chat:', error);
    return new ChatSDKError(
      'internal_server_error:chat',
      'Failed to delete chat',
    ).toResponse();
  }
}
