import { auth, currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { upsertUser } from '@/lib/db/queries';
import { ensureDemoWorkspace } from '@/lib/db/demo-data';
import { WelcomeContent } from './welcome-content';
import { WelcomeError } from './welcome-error';
import WelcomeLoading from './loading';

async function WelcomePageContent({ userId }: { userId: string }) {
  // Get full user details from Clerk
  const clerkUser = await currentUser();

  if (!clerkUser) {
    redirect('/login');
  }

  // Sync user data to database (in case webhook hasn't fired yet)
  // Always upsert - it handles both insert and update cases
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

  // Ensure user has a Demo workspace (creates or finds existing)
  const result = await ensureDemoWorkspace(userId);

  if (!result.success) {
    // Show error state but still allow proceeding with empty workspace
    return (
      <WelcomeError message={result.error} workspaceId={result.workspaceId} />
    );
  }

  return (
    <WelcomeContent
      workspaceId={result.workspaceId}
      isNewWorkspace={result.counts.chats > 0}
      userName={clerkUser.firstName || undefined}
    />
  );
}

export default async function WelcomePage() {
  const { userId } = await auth();

  if (!userId) {
    redirect('/login');
  }

  return (
    <Suspense fallback={<WelcomeLoading />}>
      <WelcomePageContent userId={userId} />
    </Suspense>
  );
}
