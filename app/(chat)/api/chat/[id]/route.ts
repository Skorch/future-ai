import { auth } from '@clerk/nextjs/server';
import { deleteChatById, getChatById } from '@/lib/db/queries';
import { ChatSDKError } from '@/lib/errors';
import { getActiveWorkspace } from '@/lib/workspace/context';
import { getLogger } from '@/lib/logger';

const logger = getLogger('ChatAPI');

export async function GET(
  request: Request,
  props: { params: Promise<{ id: string }> },
) {
  const params = await props.params;
  const chatId = params.id;
  const { userId } = await auth();

  if (!userId) {
    return new ChatSDKError('unauthorized:api').toResponse();
  }

  const workspaceId = await getActiveWorkspace(userId);

  try {
    const chat = await getChatById({ id: chatId, workspaceId });

    if (!chat) {
      return new ChatSDKError('not_found:chat').toResponse();
    }

    return Response.json(chat);
  } catch (error) {
    logger.error('Failed to get chat:', error);
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
  const { userId } = await auth();

  if (!userId) {
    return new ChatSDKError('unauthorized:api').toResponse();
  }

  const workspaceId = await getActiveWorkspace(userId);

  try {
    await deleteChatById({ id: chatId, workspaceId });
    return Response.json({ success: true });
  } catch (error) {
    logger.error('Failed to delete chat:', error);
    return new ChatSDKError(
      'internal_server_error:chat',
      'Failed to delete chat',
    ).toResponse();
  }
}
