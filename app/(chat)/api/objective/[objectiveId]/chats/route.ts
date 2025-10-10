import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getChatsByObjectiveId } from '@/lib/db/queries';
import { getLogger } from '@/lib/logger';

const logger = getLogger('ObjectiveChatsAPI');

export async function GET(
  request: Request,
  props: { params: Promise<{ objectiveId: string }> },
) {
  const params = await props.params;
  const { objectiveId } = params;
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const chats = await getChatsByObjectiveId(objectiveId, userId);
    return NextResponse.json(chats);
  } catch (error) {
    logger.error('Failed to get chats:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
