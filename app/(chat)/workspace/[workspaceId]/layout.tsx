import { notFound } from 'next/navigation';
import { cookies } from 'next/headers';
import { auth } from '@clerk/nextjs/server';
import { getWorkspaceById } from '@/lib/workspace/queries';
import { AppSidebar } from '@/components/app-sidebar';
import { SidebarProvider } from '@/components/ui/sidebar';
import { SidebarInsetWithTrigger } from '@/components/sidebar-inset-with-trigger';
import type { ReactNode } from 'react';

export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ workspaceId: string }>;
}) {
  const { userId } = await auth();
  const { workspaceId } = await params;

  if (!userId) {
    // This shouldn't happen as middleware should catch it, but just in case
    notFound();
  }

  // Validate that the workspace exists and belongs to the user
  const workspace = await getWorkspaceById(workspaceId, userId);

  if (!workspace) {
    // User doesn't have access to this workspace
    notFound();
  }

  // Get sidebar state from cookies
  const cookieStore = await cookies();
  const isCollapsed = cookieStore.get('sidebar:state')?.value === 'false';

  return (
    <SidebarProvider defaultOpen={!isCollapsed}>
      <AppSidebar workspaceId={workspaceId} />
      <SidebarInsetWithTrigger>{children}</SidebarInsetWithTrigger>
    </SidebarProvider>
  );
}
