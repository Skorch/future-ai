import { redirect } from 'next/navigation';
import { auth } from '@/app/(auth)/auth';
import { getActiveWorkspace } from '@/lib/workspace/context';

export default async function RootPage() {
  const session = await auth();

  if (!session?.user) {
    // For unauthenticated users, redirect to guest auth which will handle workspace creation
    redirect('/api/auth/guest');
  }

  // Get the active workspace for authenticated user
  const workspaceId = await getActiveWorkspace(session.user.id);

  // Redirect to the workspace
  redirect(`/workspace/${workspaceId}`);
}
