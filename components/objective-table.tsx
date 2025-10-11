'use client';

import { useMemo, useState } from 'react';
import DataGrid, { type Column } from 'react-data-grid';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import {
  MoreHorizontalIcon,
  Trash,
  Eye,
  MessageSquarePlus,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { useSWRConfig } from 'swr';
import { toast } from 'sonner';
import { useResponsiveColumns } from '@/hooks/use-responsive-columns';
import { useTableHeight } from '@/hooks/use-table-height';
import {
  deleteObjectiveAction,
  publishObjectiveAction,
  unpublishObjectiveAction,
} from '@/lib/objective/actions';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import type { Objective } from '@/lib/db/schema';
import 'react-data-grid/lib/styles.css';

interface ObjectiveTableProps {
  objectives: Objective[];
  workspaceId: string;
}

export function ObjectiveTable({
  objectives,
  workspaceId,
}: ObjectiveTableProps) {
  const router = useRouter();
  const { mutate } = useSWRConfig();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const handleView = (objectiveId: string) => {
    router.push(`/workspace/${workspaceId}/objective/${objectiveId}`);
  };

  const handleStartChat = (objectiveId: string) => {
    router.push(
      `/workspace/${workspaceId}/chat/new?objectiveId=${objectiveId}`,
    );
  };

  const handlePublish = async (objectiveId: string) => {
    const result = await publishObjectiveAction(objectiveId);

    if (result.success) {
      toast.success('Objective published');
      // Invalidate SWR cache
      if (result.revalidate?.swrKeys) {
        result.revalidate.swrKeys.forEach((key) => mutate(key));
      }
    } else {
      toast.error(`Failed to publish: ${result.error}`);
    }
  };

  const handleUnpublish = async (objectiveId: string) => {
    const result = await unpublishObjectiveAction(objectiveId);

    if (result.success) {
      toast.success('Objective unpublished');
      // Invalidate SWR cache
      if (result.revalidate?.swrKeys) {
        result.revalidate.swrKeys.forEach((key) => mutate(key));
      }
    } else {
      toast.error(`Failed to unpublish: ${result.error}`);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;

    const result = await deleteObjectiveAction(deleteId);

    if (result.success) {
      toast.success('Objective deleted');
      setShowDeleteDialog(false);
      setDeleteId(null);
      // Invalidate SWR cache
      if (result.revalidate?.swrKeys) {
        result.revalidate.swrKeys.forEach((key) => mutate(key));
      }
    } else {
      toast.error(`Failed to delete: ${result.error}`);
    }
  };

  const allColumns = useMemo<Column<Objective>[]>(
    () => [
      {
        key: 'title',
        name: 'Objective',
        resizable: true,
        renderCell: ({ row }) => {
          return (
            <button
              type="button"
              className="text-left text-sm font-medium hover:text-primary focus:outline-none w-full truncate transition-colors"
              onClick={() => handleView(row.id)}
              title={row.title}
            >
              {row.title}
            </button>
          );
        },
      },
      {
        key: 'documentType',
        name: 'Type',
        width: 120,
        renderCell: ({ row }) => (
          <Badge variant="outline" className="capitalize">
            {row.documentType}
          </Badge>
        ),
      },
      {
        key: 'status',
        name: 'Status',
        width: 120,
        renderCell: ({ row }) => (
          <Badge
            variant={row.status === 'published' ? 'default' : 'secondary'}
            className="capitalize"
          >
            {row.status}
          </Badge>
        ),
      },
      {
        key: 'createdAt',
        name: 'Created',
        width: 180,
        renderCell: ({ row }) => (
          <span className="text-sm text-muted-foreground py-2 block">
            {formatDistanceToNow(new Date(row.createdAt), { addSuffix: true })}
          </span>
        ),
      },
      {
        key: 'actions',
        name: '',
        width: 50,
        renderCell: ({ row }) => (
          <div className="flex items-center justify-center">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 p-0 data-[state=open]:bg-muted hover:bg-muted/50 transition-colors"
                >
                  <MoreHorizontalIcon className="h-4 w-4" />
                  <span className="sr-only">Open menu</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem
                  className="cursor-pointer"
                  onClick={() => handleView(row.id)}
                >
                  <Eye className="mr-2 size-4" />
                  <span>View Objective</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="cursor-pointer"
                  onClick={() => handleStartChat(row.id)}
                >
                  <MessageSquarePlus className="mr-2 size-4" />
                  <span>Start New Chat</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {row.status === 'open' ? (
                  <DropdownMenuItem
                    className="cursor-pointer"
                    onClick={() => handlePublish(row.id)}
                  >
                    <CheckCircle className="mr-2 size-4" />
                    <span>Publish Objective</span>
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem
                    className="cursor-pointer"
                    onClick={() => handleUnpublish(row.id)}
                  >
                    <XCircle className="mr-2 size-4" />
                    <span>Unpublish Objective</span>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="cursor-pointer text-destructive focus:text-destructive"
                  onClick={() => {
                    setDeleteId(row.id);
                    setShowDeleteDialog(true);
                  }}
                >
                  <Trash className="mr-2 size-4" />
                  <span>Delete Objective</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ),
      },
    ],
    [workspaceId],
  );

  // Apply responsive column filtering
  const columns = useResponsiveColumns(allColumns, {
    mobile: ['title', 'status', 'actions'],
    tablet: ['title', 'status', 'createdAt', 'actions'],
  });

  // Calculate dynamic table height
  const height = useTableHeight(objectives.length);

  return (
    <>
      <DataGrid
        columns={columns}
        rows={objectives}
        rowKeyGetter={(row) => row.id}
        className="rdg-light dark:rdg-dark [&_.rdg-row:hover]:bg-muted/50 [&_.rdg-row]:transition-colors [&_.rdg-cell]:py-2 [&_.rdg-header-row]:font-semibold"
        style={{ height }}
      />

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this objective and all associated
              chats.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteId(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
