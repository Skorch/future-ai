import { auth } from '@clerk/nextjs/server';
import { getChatById, getVotesByChatId, voteMessage } from '@/lib/db/queries';
import { ChatSDKError } from '@/lib/errors';
import { getActiveWorkspace } from '@/lib/workspace/context';

export async function GET(
  request: Request,
  props: { params: Promise<{ id: string }> },
) {
  const params = await props.params;
  const chatId = params.id;

  const { userId } = await auth();

  if (!userId) {
    return new ChatSDKError('unauthorized:vote').toResponse();
  }

  const workspaceId = await getActiveWorkspace(userId);
  const chat = await getChatById({ id: chatId, workspaceId });

  if (!chat) {
    return new ChatSDKError('not_found:chat').toResponse();
  }

  if (chat.userId !== userId) {
    return new ChatSDKError('forbidden:vote').toResponse();
  }

  const votes = await getVotesByChatId({ id: chatId });

  return Response.json(votes, { status: 200 });
}

export async function PATCH(
  request: Request,
  props: { params: Promise<{ id: string }> },
) {
  const params = await props.params;
  const chatId = params.id;
  const { messageId, type }: { messageId: string; type: 'up' | 'down' } =
    await request.json();

  if (!messageId || !type) {
    return new ChatSDKError(
      'bad_request:api',
      'Parameters messageId and type are required.',
    ).toResponse();
  }

  const { userId } = await auth();

  if (!userId) {
    return new ChatSDKError('unauthorized:vote').toResponse();
  }

  const workspaceId = await getActiveWorkspace(userId);
  const chat = await getChatById({ id: chatId, workspaceId });

  if (!chat) {
    return new ChatSDKError('not_found:vote').toResponse();
  }

  if (chat.userId !== userId) {
    return new ChatSDKError('forbidden:vote').toResponse();
  }

  await voteMessage({
    chatId,
    messageId,
    type: type,
  });

  return new Response('Message voted', { status: 200 });
}
