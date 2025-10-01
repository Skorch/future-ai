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

  // Redirect to chat list as the default workspace view
  redirect(`/workspace/${workspaceId}/chat`);
}
