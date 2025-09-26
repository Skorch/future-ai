import { redirect } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import { getActiveWorkspace } from '@/lib/workspace/context';

export default async function RootPage() {
  const { userId } = await auth();

  if (!userId) {
    // For unauthenticated users, redirect to login
    redirect('/login');
  }

  // Get the active workspace for authenticated user
  const workspaceId = await getActiveWorkspace(userId);

  // Redirect to the workspace
  redirect(`/workspace/${workspaceId}`);
}
