import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { Chat } from '@/components/chat';
import { DataStreamHandler } from '@/components/data-stream-handler';
import { generateUUID } from '@/lib/utils';

export default async function NewChatPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceId: string }>;
  searchParams: Promise<{
    objectiveId?: string;
    query?: string;
    autoSubmit?: string;
  }>;
}) {
  const { userId } = await auth();
  const { workspaceId } = await params;
  const { objectiveId, query, autoSubmit } = await searchParams;

  if (!userId) {
    redirect('/login');
  }

  // Generate a new chat ID for this session
  const chatId = generateUUID();

  return (
    <>
      <Chat
        id={chatId}
        workspaceId={workspaceId}
        initialMessages={[]}
        isReadonly={false}
        autoResume={false}
        chat={null}
        objectiveId={objectiveId}
        initialQuery={query}
        shouldAutoSubmit={autoSubmit === 'true'}
      />
      <DataStreamHandler />
    </>
  );
}
