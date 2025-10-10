import { redirect } from 'next/navigation';
import { auth, currentUser } from '@clerk/nextjs/server';
import { getActiveWorkspace } from '@/lib/workspace/context';
import { upsertUser } from '@/lib/db/queries';

export default async function RootPage() {
  const { userId } = await auth();

  if (!userId) {
    // For unauthenticated users, redirect to login
    redirect('/login');
  }

  // Ensure user exists in database (sync from Clerk)
  const clerkUser = await currentUser();
  if (clerkUser) {
    await upsertUser({
      id: clerkUser.id,
      email: clerkUser.emailAddresses[0]?.emailAddress || '',
      firstName: clerkUser.firstName,
      lastName: clerkUser.lastName,
      imageUrl: clerkUser.imageUrl,
      emailVerified:
        clerkUser.emailAddresses[0]?.verification?.status === 'verified',
      createdAt: new Date(clerkUser.createdAt),
      updatedAt: new Date(clerkUser.updatedAt || clerkUser.createdAt),
    });
  }

  // Get the active workspace for authenticated user
  const workspaceId = await getActiveWorkspace(userId);

  // Redirect to the workspace
  redirect(`/workspace/${workspaceId}`);
}
