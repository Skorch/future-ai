'use client';

import { useRouter } from 'next/navigation';
import {
  Home,
  Globe,
  FileType,
  BookOpen,
  MessageSquare,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';

import { SidebarUserNav } from '@/components/sidebar-user-nav';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  useSidebar,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
} from '@/components/ui/sidebar';
import { clearAllCacheAction } from '@/app/admin/actions';

export function AdminSidebar() {
  const router = useRouter();
  const { setOpenMobile } = useSidebar();

  const adminNavItems = [
    {
      title: 'Domains',
      icon: Globe,
      href: '/admin/domains',
    },
    {
      title: 'Artifact Types',
      icon: FileType,
      href: '/admin/artifact-types',
    },
    {
      title: 'Playbooks',
      icon: BookOpen,
      href: '/admin/playbooks',
    },
    {
      title: 'Prompts',
      icon: MessageSquare,
      href: '/admin/prompts',
    },
  ];

  const handleClearCache = async () => {
    try {
      const result = await clearAllCacheAction();
      if (result.success) {
        toast.success(result.message);
        // Refresh the page to reflect cache clearing
        router.refresh();
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error('Failed to clear cache');
    }
  };

  return (
    <Sidebar className="group-data-[side=left]:border-r-0">
      <SidebarHeader className="pt-6 pb-4 border-b border-sidebar-border">
        <SidebarMenu>
          {/* Home Link */}
          <SidebarMenuItem>
            <SidebarMenuButton
              className="justify-start gap-3 py-6"
              onClick={() => {
                setOpenMobile(false);
                router.push('/');
              }}
            >
              <Home className="size-5 shrink-0" />
              <span className="font-semibold text-base">Home</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Management</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {adminNavItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    onClick={() => {
                      setOpenMobile(false);
                      router.push(item.href);
                    }}
                  >
                    <item.icon className="size-4" />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>System</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              <SidebarMenuItem>
                <SidebarMenuButton onClick={handleClearCache}>
                  <Trash2 className="size-4" />
                  <span>Clear All Cache</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarUserNav />
      </SidebarFooter>
    </Sidebar>
  );
}
