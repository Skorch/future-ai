import { notFound } from 'next/navigation';
import { cookies } from 'next/headers';
import { auth } from '@/app/(auth)/auth';
import { getWorkspaceById } from '@/lib/workspace/queries';
import { AppSidebar } from '@/components/app-sidebar';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import type { ReactNode } from 'react';

export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ workspaceId: string }>;
}) {
  const session = await auth();
  const { workspaceId } = await params;

  if (!session?.user) {
    // This shouldn't happen as middleware should catch it, but just in case
    notFound();
  }

  // Validate that the workspace exists and belongs to the user
  const workspace = await getWorkspaceById(workspaceId, session.user.id);

  if (!workspace) {
    // User doesn't have access to this workspace
    notFound();
  }

  // Get sidebar state from cookies
  const cookieStore = await cookies();
  const isCollapsed = cookieStore.get('sidebar:state')?.value !== 'true';

  return (
    <SidebarProvider defaultOpen={!isCollapsed}>
      <AppSidebar user={session.user} workspaceId={workspaceId} />
      <SidebarInset>{children}</SidebarInset>
    </SidebarProvider>
  );
}
