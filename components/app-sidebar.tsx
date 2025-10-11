'use client';

import { useRouter } from 'next/navigation';

import { PlusIcon } from '@/components/icons';
import { SidebarObjectives } from '@/components/sidebar-objectives';
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

export function AppSidebar({ workspaceId }: { workspaceId: string }) {
  const router = useRouter();
  const { setOpenMobile } = useSidebar();

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
                router.push(`/workspace/${workspaceId}?create=true`);
              }}
            >
              <PlusIcon size={16} />
              New Objective
            </Button>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarObjectives workspaceId={workspaceId} />
      </SidebarContent>
      <SidebarFooter>
        <SidebarUserNav />
      </SidebarFooter>
    </Sidebar>
  );
}
