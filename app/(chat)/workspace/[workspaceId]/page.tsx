import { Chat } from '@/components/chat';
import { generateUUID } from '@/lib/utils';
import { DataStreamHandler } from '@/components/data-stream-handler';
import { auth } from '@/app/(auth)/auth';
import { redirect } from 'next/navigation';

export default async function Page({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const session = await auth();
  const { workspaceId } = await params;

  if (!session) {
    redirect('/api/auth/guest');
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
        session={session}
        autoResume={false}
      />
      <DataStreamHandler />
    </>
  );
}
