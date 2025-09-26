import { auth, currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import {
  getWorkspacesByUserId,
  createWorkspace,
} from '@/lib/workspace/queries';
import { getUserById, upsertUser } from '@/lib/db/queries';
import { Button } from '@/components/ui/button';

export default async function WelcomePage() {
  const { userId } = await auth();

  if (!userId) {
    redirect('/login');
  }

  // Get full user details from Clerk
  const clerkUser = await currentUser();

  if (!clerkUser) {
    redirect('/login');
  }

  // Sync user data to database (in case webhook hasn't fired yet)
  const existingUser = await getUserById(userId);

  if (!existingUser) {
    // User doesn't exist in database yet (webhook may be delayed)
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
  } else {
    // Update user data in case it changed
    await upsertUser({
      id: clerkUser.id,
      email: clerkUser.emailAddresses[0]?.emailAddress || existingUser.email,
      firstName: clerkUser.firstName,
      lastName: clerkUser.lastName,
      imageUrl: clerkUser.imageUrl,
      emailVerified:
        clerkUser.emailAddresses[0]?.verification?.status === 'verified',
      updatedAt: new Date(),
    });
  }

  // Check if user has at least one workspace
  const workspaces = await getWorkspacesByUserId(userId);

  if (workspaces.length === 0) {
    // Create default workspace for new user
    await createWorkspace(
      userId,
      'Personal Workspace',
      'Your personal workspace',
    );
  }

  return (
    <div className="flex h-screen w-full flex-col items-center justify-center px-4">
      <div className="max-w-md text-center space-y-6">
        <h1 className="text-4xl font-bold">
          Welcome{clerkUser.firstName ? `, ${clerkUser.firstName}` : ''} to AI
          Chatbot
        </h1>
        <p className="text-lg text-muted-foreground">
          Your intelligent AI assistant is ready to help you with conversations,
          document analysis, and more. Let's get started!
        </p>
        <div className="space-y-4">
          <div className="text-left space-y-2 text-sm text-muted-foreground">
            <div className="flex items-start gap-2">
              <span className="text-primary">✓</span>
              <span>Your workspace has been created</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-primary">✓</span>
              <span>Start conversations with advanced AI models</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-primary">✓</span>
              <span>Upload and analyze documents</span>
            </div>
          </div>
        </div>
        <Button asChild size="lg" className="w-full">
          <Link href="/">Get Started</Link>
        </Button>
      </div>
    </div>
  );
}
