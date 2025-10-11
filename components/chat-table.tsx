'use client';

import { useMemo, useState } from 'react';
import DataGrid, { type Column } from 'react-data-grid';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { MoreHorizontalIcon, Trash } from 'lucide-react';
import { useResponsiveColumns } from '@/hooks/use-responsive-columns';
import { useTableHeight } from '@/hooks/use-table-height';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
import { toast } from 'sonner';
import 'react-data-grid/lib/styles.css';

interface ChatRow {
  id: string;
  title: string;
  createdAt: Date;
  messageCount: number;
}

interface ChatTableProps {
  chats: ChatRow[];
  workspaceId: string;
  onChatDeleted?: (chatId: string) => void;
}

export function ChatTable({
  chats,
  workspaceId,
  onChatDeleted,
}: ChatTableProps) {
  const router = useRouter();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const handleDelete = async () => {
    if (!deleteId) return;

    const deletePromise = fetch(`/api/chat/${deleteId}`, {
      method: 'DELETE',
    });

    toast.promise(deletePromise, {
      loading: 'Deleting chat...',
      success: () => {
        if (onChatDeleted) {
          onChatDeleted(deleteId);
        }
        setShowDeleteDialog(false);
        setDeleteId(null);
        router.refresh();
        return 'Chat deleted successfully';
      },
      error: 'Failed to delete chat',
    });
  };

  const allColumns = useMemo<Column<ChatRow>[]>(
    () => [
      {
        key: 'title',
        name: 'Title',
        resizable: true,
        renderCell: ({ row }) => {
          return (
            <button
              type="button"
              className="text-left text-sm font-medium hover:text-primary focus:outline-none w-full py-2 truncate transition-colors"
              onClick={() =>
                router.push(`/workspace/${workspaceId}/chat/${row.id}`)
              }
              title={row.title}
            >
              {row.title}
            </button>
          );
        },
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
        key: 'messageCount',
        name: 'Messages',
        width: 120,
        renderCell: ({ row }) => (
          <span className="text-sm py-2 block">{row.messageCount}</span>
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
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                  className="cursor-pointer text-destructive focus:text-destructive"
                  onClick={() => {
                    setDeleteId(row.id);
                    setShowDeleteDialog(true);
                  }}
                >
                  <Trash className="mr-2 size-4" />
                  <span>Delete Chat</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ),
      },
    ],
    [workspaceId, router],
  );

  // Apply responsive column filtering
  const columns = useResponsiveColumns(allColumns, {
    mobile: ['title', 'messageCount'],
    tablet: ['title', 'createdAt', 'actions'],
  });

  // Calculate dynamic table height
  const height = useTableHeight(chats.length);

  return (
    <>
      <DataGrid
        columns={columns}
        rows={chats}
        rowKeyGetter={(row) => row.id}
        className="rdg-light dark:rdg-dark [&_.rdg-row:hover]:bg-muted/50 [&_.rdg-row]:transition-colors [&_.rdg-cell]:py-2 [&_.rdg-header-row]:text-sm [&_.rdg-header-row]:font-bold"
        style={{ height }}
      />

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete your
              chat and remove it from our servers.
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
