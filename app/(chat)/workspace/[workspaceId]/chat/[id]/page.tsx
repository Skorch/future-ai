import { notFound, redirect } from 'next/navigation';

import { auth } from '@clerk/nextjs/server';
import { Chat } from '@/components/chat';
import {
  getChatByIdWithWorkspace,
  getMessagesByChatId,
} from '@/lib/db/queries';
import { DataStreamHandler } from '@/components/data-stream-handler';
import { convertToUIMessages } from '@/lib/utils';

export default async function Page(props: {
  params: Promise<{ workspaceId: string; id: string }>;
}) {
  const params = await props.params;
  const { workspaceId, id } = params;

  const { userId } = await auth();

  if (!userId) {
    redirect('/login');
  }

  const chat = await getChatByIdWithWorkspace({ id, workspaceId, userId });

  if (!chat) {
    notFound();
  }

  const messagesFromDb = await getMessagesByChatId({
    id,
  });

  const uiMessages = convertToUIMessages(messagesFromDb);

  return (
    <>
      <Chat
        id={chat.id}
        workspaceId={workspaceId}
        initialMessages={uiMessages}
        isReadonly={userId !== chat.userId}
        autoResume={true}
        chat={chat}
        objectiveId={chat.objectiveId}
      />
      <DataStreamHandler />
    </>
  );
}
