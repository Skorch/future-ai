'use client';

import React from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  useSidebar,
} from '@/components/ui/sidebar';
import { fetcher } from '@/lib/utils';
import { CheckCircleFillIcon, FileIcon } from '@/components/icons';
import useSWR from 'swr';
import type { Objective } from '@/lib/db/schema';

export function SidebarObjectives({ workspaceId }: { workspaceId: string }) {
  const { setOpenMobile } = useSidebar();
  const params = useParams();
  const router = useRouter();

  const { data, isLoading } = useSWR<Objective[]>(
    `/api/workspace/${workspaceId}/objectives`,
    fetcher,
  );

  const objectives = data ?? [];
  const currentObjectiveId = params.objectiveId as string | undefined;

  if (isLoading) {
    return (
      <SidebarGroup>
        <div className="px-2 py-1 text-xs text-sidebar-foreground/50">
          Objectives
        </div>
        <SidebarGroupContent>
          <div className="flex flex-col">
            {[44, 32, 48, 36, 52].map((width) => (
              <div
                key={width}
                className="flex gap-2 items-center px-2 h-8 rounded-md"
              >
                <div
                  className="h-4 rounded-md flex-1 max-w-[--skeleton-width] bg-sidebar-accent-foreground/10"
                  style={
                    {
                      '--skeleton-width': `${width}%`,
                    } as React.CSSProperties
                  }
                />
              </div>
            ))}
          </div>
        </SidebarGroupContent>
      </SidebarGroup>
    );
  }

  if (objectives.length === 0) {
    return (
      <SidebarGroup>
        <div className="px-2 py-1 text-xs text-sidebar-foreground/50">
          Objectives
        </div>
        <SidebarGroupContent>
          <div className="flex flex-row gap-2 justify-center items-center px-2 w-full text-sm text-zinc-500">
            No objectives yet. Create one to get started!
          </div>
        </SidebarGroupContent>
      </SidebarGroup>
    );
  }

  return (
    <SidebarGroup>
      <div className="border-t border-sidebar-border pt-4">
        <div className="px-2 pb-2 text-sm font-semibold text-sidebar-foreground">
          Objectives
        </div>
      </div>
      <SidebarGroupContent>
        <SidebarMenu>
          {objectives.map((objective) => {
            const StatusIcon =
              objective.status === 'published' ? CheckCircleFillIcon : FileIcon;
            const isActive = objective.id === currentObjectiveId;

            return (
              <SidebarMenuItem key={objective.id}>
                <SidebarMenuButton
                  isActive={isActive}
                  onClick={() => {
                    setOpenMobile(false);
                    router.push(
                      `/workspace/${workspaceId}/objective/${objective.id}`,
                    );
                  }}
                >
                  <StatusIcon size={16} />
                  <span className="truncate">{objective.title}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>

        {/* View All Objectives link */}
        <div className="p-2">
          <button
            type="button"
            className="w-full text-left text-sm text-muted-foreground hover:text-foreground transition-colors py-1"
            onClick={() => {
              setOpenMobile(false);
              router.push(`/workspace/${workspaceId}`);
            }}
          >
            View All Objectives →
          </button>
        </div>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
