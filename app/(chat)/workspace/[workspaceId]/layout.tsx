import { notFound } from 'next/navigation';
import { cookies } from 'next/headers';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { getWorkspaceById } from '@/lib/workspace/queries';
import { AppSidebar } from '@/components/app-sidebar';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { DEFAULT_DOMAIN, type DomainId } from '@/lib/domains';
import { getLogger } from '@/lib/logger';
import type { ReactNode } from 'react';

const logger = getLogger('WorkspaceLayout');

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

  // Get agent domain from Clerk metadata (for sidebar UI)
  let domainId: DomainId = DEFAULT_DOMAIN;
  try {
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    domainId = (user.publicMetadata?.agentDomain as DomainId) || DEFAULT_DOMAIN;
  } catch (error) {
    // Fall back to default if fetch fails
    logger.error('Failed to fetch user domain in layout', error);
  }

  // Get sidebar state from cookies
  const cookieStore = await cookies();
  const isCollapsed = cookieStore.get('sidebar:state')?.value !== 'true';

  return (
    <SidebarProvider defaultOpen={!isCollapsed}>
      <AppSidebar workspaceId={workspaceId} initialDomain={domainId} />
      <SidebarInset>{children}</SidebarInset>
    </SidebarProvider>
  );
}
