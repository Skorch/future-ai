'use client';

import { useRouter } from 'next/navigation';

import { PlusIcon } from '@/components/icons';
import { SidebarHistory } from '@/components/sidebar-history';
import { SidebarDocuments } from '@/components/sidebar-documents';
import { SidebarUserNav } from '@/components/sidebar-user-nav';
import { WorkspaceSwitcher } from '@/components/workspace-switcher';
import { Button } from '@/components/ui/button';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
import type { DomainId } from '@/lib/domains';

export function AppSidebar({
  workspaceId,
  initialDomain,
}: {
  workspaceId: string;
  initialDomain: DomainId;
}) {
  const router = useRouter();
  const { setOpenMobile } = useSidebar();

  const newChatUrl = `/workspace/${workspaceId}/chat/new`;
  const chatsUrl = `/workspace/${workspaceId}/chat`;
  const documentsUrl = `/workspace/${workspaceId}/document`;

  return (
    <Sidebar className="group-data-[side=left]:border-r-0">
      <SidebarHeader className="pt-8 pb-4 border-b border-sidebar-border">
        <SidebarMenu className="gap-3">
          <SidebarMenuItem>
            <WorkspaceSwitcher currentWorkspaceId={workspaceId} />
          </SidebarMenuItem>
          <SidebarMenuItem>
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => {
                setOpenMobile(false);
                router.push(newChatUrl);
                router.refresh();
              }}
            >
              <PlusIcon size={16} />
              New Chat
            </Button>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarHistory workspaceId={workspaceId} />
        <SidebarDocuments workspaceId={workspaceId} />
      </SidebarContent>
      <SidebarFooter>
        <SidebarUserNav initialDomain={initialDomain} />
      </SidebarFooter>
    </Sidebar>
  );
}
