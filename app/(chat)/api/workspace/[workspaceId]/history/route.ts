import { auth } from '@clerk/nextjs/server';
import type { NextRequest } from 'next/server';
import { getChatsByWorkspaceAndUser } from '@/lib/db/queries';
import { ChatSDKError } from '@/lib/errors';

export async function GET(
  request: NextRequest,
  props: { params: Promise<{ workspaceId: string }> },
) {
  const params = await props.params;
  const { workspaceId } = params;
  const { searchParams } = request.nextUrl;

  const limit = Number.parseInt(searchParams.get('limit') || '10');
  const startingAfter = searchParams.get('starting_after');
  const endingBefore = searchParams.get('ending_before');

  if (startingAfter && endingBefore) {
    return new ChatSDKError(
      'bad_request:api',
      'Only one of starting_after or ending_before can be provided.',
    ).toResponse();
  }

  const { userId } = await auth();

  if (!userId) {
    return new ChatSDKError('unauthorized:chat').toResponse();
  }

  const chats = await getChatsByWorkspaceAndUser({
    workspaceId,
    userId: userId,
    limit,
    startingAfter,
    endingBefore,
  });

  // Return in the expected ChatHistory format
  return Response.json({
    chats,
    hasMore: chats.length === limit,
  });
}
