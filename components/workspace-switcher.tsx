'use client';

import { getLogger } from '@/lib/logger';

const logger = getLogger('workspace-switcher');
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { toast } from 'sonner';
import { ChevronDown, Plus, Trash2, Check, LoaderIcon } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { fetcher } from '@/lib/utils';
import type { Workspace } from '@/lib/db/schema';
import type { WorkspaceWithDomain } from '@/lib/workspace/queries';
import {
  CreateWorkspaceDialog,
  DeleteWorkspaceDialog,
} from './workspace-dialogs';

interface WorkspaceSwitcherProps {
  currentWorkspaceId: string;
}

function WorkspaceSwitcherContent({
  currentWorkspaceId,
}: WorkspaceSwitcherProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const {
    data: workspaces,
    mutate,
    isLoading,
  } = useSWR<WorkspaceWithDomain[]>('/api/workspace', fetcher, {
    revalidateOnFocus: false,
    fallbackData: [], // Provide empty array as fallback for SSR
  });

  const currentWorkspace = workspaces?.find((w) => w.id === currentWorkspaceId);

  const handleWorkspaceSwitch = async (workspaceId: string) => {
    if (workspaceId === currentWorkspaceId) return;

    // Optimistic update
    startTransition(() => {
      router.push(`/workspace/${workspaceId}`);
    });

    try {
      const response = await fetch('/api/workspace/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId }),
      });

      if (!response.ok) {
        throw new Error('Failed to switch workspace');
      }

      // The router.push above will trigger a re-render with the new workspace
    } catch (error) {
      logger.error('Failed to switch workspace:', error);
      toast.error('Failed to switch workspace');
      // Router push already happened, so page will show error if workspace doesn't exist
    }
  };

  const handleCreateSuccess = async (newWorkspace: Workspace) => {
    // Switch to the new workspace
    startTransition(() => {
      router.push(`/workspace/${newWorkspace.id}`);
    });

    // Revalidate to fetch workspace with domain title
    mutate();

    toast.success(`Created workspace "${newWorkspace.name}"`);
    setShowCreateDialog(false);
  };

  const handleDeleteSuccess = async (deletedId: string) => {
    // Optimistically remove the workspace
    const updatedWorkspaces =
      workspaces?.filter((w) => w.id !== deletedId) || [];
    mutate(updatedWorkspaces, false);

    // If we deleted the current workspace, switch to another
    if (deletedId === currentWorkspaceId && updatedWorkspaces.length > 0) {
      const nextWorkspace = updatedWorkspaces[0];
      startTransition(() => {
        router.push(`/workspace/${nextWorkspace.id}`);
      });
    }

    // Revalidate in background
    mutate();

    toast.success('Workspace deleted');
    setShowDeleteDialog(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 px-2">
        <LoaderIcon className="size-4 animate-spin" />
        <span className="text-lg font-semibold">Loading...</span>
      </div>
    );
  }

  if (!workspaces || workspaces.length === 0) {
    return (
      <div className="px-2 text-sm text-muted-foreground">No workspaces</div>
    );
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger className="flex items-center gap-2 px-2 hover:bg-muted rounded-md transition-colors">
          <span className="text-lg font-semibold">
            {isPending ? (
              <LoaderIcon className="size-4 animate-spin" />
            ) : (
              currentWorkspace?.name || 'Select Workspace'
            )}
          </span>
          <ChevronDown className="size-4 opacity-50" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-[240px]">
          {workspaces.map((workspace) => {
            return (
              <DropdownMenuItem
                key={workspace.id}
                onClick={() => handleWorkspaceSwitch(workspace.id)}
                className="flex items-center justify-between"
              >
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span>{workspace.name}</span>
                    {workspace.domainTitle && (
                      <span className="px-1.5 py-0.5 text-[10px] font-medium bg-muted rounded uppercase">
                        {workspace.domainTitle}
                      </span>
                    )}
                  </div>
                  {workspace.description && (
                    <span className="text-xs text-muted-foreground">
                      {workspace.description}
                    </span>
                  )}
                </div>
                {workspace.id === currentWorkspaceId && (
                  <Check className="size-4" />
                )}
              </DropdownMenuItem>
            );
          })}

          <DropdownMenuSeparator />

          <DropdownMenuItem
            onClick={() => setShowCreateDialog(true)}
            className="flex items-center gap-2"
          >
            <Plus className="size-4" />
            <span>Create New Workspace</span>
          </DropdownMenuItem>

          {workspaces.length > 1 && (
            <DropdownMenuItem
              onClick={() => setShowDeleteDialog(true)}
              className="flex items-center gap-2 text-destructive focus:text-destructive"
            >
              <Trash2 className="size-4" />
              <span>Delete Current Workspace</span>
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <CreateWorkspaceDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onSuccess={handleCreateSuccess}
      />

      {currentWorkspace && (
        <DeleteWorkspaceDialog
          open={showDeleteDialog}
          onOpenChange={setShowDeleteDialog}
          workspace={currentWorkspace}
          onSuccess={handleDeleteSuccess}
          isLastWorkspace={workspaces.length === 1}
        />
      )}
    </>
  );
}

// Main component - no longer needs Suspense since we handle loading internally
export function WorkspaceSwitcher({
  currentWorkspaceId,
}: WorkspaceSwitcherProps) {
  return <WorkspaceSwitcherContent currentWorkspaceId={currentWorkspaceId} />;
}
