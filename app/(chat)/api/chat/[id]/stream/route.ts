import { auth } from '@clerk/nextjs/server';
import {
  getChatById,
  getMessagesByChatId,
  getStreamIdsByChatId,
} from '@/lib/db/queries';
import type { Chat } from '@/lib/db/schema';
import { ChatSDKError } from '@/lib/errors';
import { getActiveWorkspace } from '@/lib/workspace/context';
import type { ChatMessage } from '@/lib/types';
import { createUIMessageStream, JsonToSseTransformStream } from 'ai';
import { differenceInSeconds } from 'date-fns';
import type { ResumableStreamContext } from 'resumable-stream';

// Note: getStreamContext needs to be implemented for workspace-aware streaming
// TODO: Implement proper workspace-aware stream context
// This will be imported from the workspace route once properly implemented
const getStreamContext = (): ResumableStreamContext | null => null;

export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: chatId } = await params;

  const streamContext = getStreamContext();
  const resumeRequestedAt = new Date();

  if (!streamContext) {
    return new Response(null, { status: 204 });
  }

  if (!chatId) {
    return new ChatSDKError('bad_request:api').toResponse();
  }

  const { userId } = await auth();

  if (!userId) {
    return new ChatSDKError('unauthorized:chat').toResponse();
  }

  const workspaceId = await getActiveWorkspace(userId);
  let chat: Chat;

  try {
    chat = await getChatById({ id: chatId, workspaceId });
  } catch {
    return new ChatSDKError('not_found:chat').toResponse();
  }

  if (!chat) {
    return new ChatSDKError('not_found:chat').toResponse();
  }

  if (chat.visibility === 'private' && chat.userId !== userId) {
    return new ChatSDKError('forbidden:chat').toResponse();
  }

  const streamIds = await getStreamIdsByChatId({ chatId });

  if (!streamIds.length) {
    return new ChatSDKError('not_found:stream').toResponse();
  }

  const recentStreamId = streamIds.at(-1);

  if (!recentStreamId) {
    return new ChatSDKError('not_found:stream').toResponse();
  }

  const emptyDataStream = createUIMessageStream<ChatMessage>({
    execute: () => {},
  });

  const stream = streamContext
    ? await streamContext.resumableStream(recentStreamId, () =>
        emptyDataStream.pipeThrough(new JsonToSseTransformStream()),
      )
    : null;

  /*
   * For when the generation is streaming during SSR
   * but the resumable stream has concluded at this point.
   */
  if (!stream) {
    const messages = await getMessagesByChatId({ id: chatId });
    const mostRecentMessage = messages.at(-1);

    if (!mostRecentMessage) {
      return new Response(emptyDataStream, { status: 200 });
    }

    if (mostRecentMessage.role !== 'assistant') {
      return new Response(emptyDataStream, { status: 200 });
    }

    const messageCreatedAt = new Date(mostRecentMessage.createdAt);

    if (differenceInSeconds(resumeRequestedAt, messageCreatedAt) > 15) {
      return new Response(emptyDataStream, { status: 200 });
    }

    const restoredStream = createUIMessageStream<ChatMessage>({
      execute: ({ writer }) => {
        writer.write({
          type: 'data-appendMessage',
          data: JSON.stringify(mostRecentMessage),
          transient: true,
        });
      },
    });

    return new Response(
      restoredStream.pipeThrough(new JsonToSseTransformStream()),
      { status: 200 },
    );
  }

  return new Response(stream, { status: 200 });
}
