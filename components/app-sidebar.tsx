'use client';

import { useRouter } from 'next/navigation';
import Image from 'next/image';

import { SidebarObjectives } from '@/components/sidebar-objectives';
import { SidebarUserNav } from '@/components/sidebar-user-nav';
import { WorkspaceSwitcher } from '@/components/workspace-switcher';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  useSidebar,
} from '@/components/ui/sidebar';

export function AppSidebar({ workspaceId }: { workspaceId: string }) {
  const router = useRouter();
  const { setOpenMobile } = useSidebar();

  return (
    <Sidebar className="group-data-[side=left]:border-r-0">
      <SidebarHeader className="pt-6 pb-4 border-b border-sidebar-border">
        <SidebarMenu className="gap-4">
          {/* Brand / Home Button */}
          <SidebarMenuItem>
            <SidebarMenuButton
              className="justify-start gap-3 py-6"
              onClick={() => {
                setOpenMobile(false);
                router.push('/');
              }}
            >
              <Image
                src="/icon.png"
                alt="The Future"
                width={24}
                height={24}
                className="shrink-0"
              />
              <span className="font-semibold text-base">The Future</span>
            </SidebarMenuButton>
          </SidebarMenuItem>

          {/* Workspace Switcher */}
          <SidebarMenuItem>
            <WorkspaceSwitcher currentWorkspaceId={workspaceId} />
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
