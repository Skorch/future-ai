import { Chat } from '@/components/chat';
import { generateUUID } from '@/lib/utils';
import { DataStreamHandler } from '@/components/data-stream-handler';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

export default async function Page({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { userId } = await auth();
  const { workspaceId } = await params;

  if (!userId) {
    redirect('/login');
  }

  const id = generateUUID();

  return (
    <>
      <Chat
        key={id}
        id={id}
        workspaceId={workspaceId}
        initialMessages={[]}
        initialVisibilityType="private"
        isReadonly={false}
        autoResume={false}
      />
      <DataStreamHandler />
    </>
  );
}
