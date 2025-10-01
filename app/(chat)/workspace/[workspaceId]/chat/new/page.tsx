import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { Chat } from '@/components/chat';
import { DataStreamHandler } from '@/components/data-stream-handler';
import { generateUUID } from '@/lib/utils';

export default async function NewChatPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { userId } = await auth();
  const { workspaceId } = await params;

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
        initialVisibilityType="private"
        isReadonly={false}
        autoResume={false}
        chat={null}
      />
      <DataStreamHandler />
    </>
  );
}
