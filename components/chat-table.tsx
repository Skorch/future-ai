'use client';

import { useMemo, useState } from 'react';
import DataGrid, { type Column } from 'react-data-grid';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { useWindowSize } from 'usehooks-ts';
import { MoreHorizontalIcon, Trash } from 'lucide-react';
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
  const { width } = useWindowSize();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Responsive breakpoints
  const isMobile = width < 640;
  const isTablet = width >= 640 && width < 1024;
  const isDesktop = width >= 1024;

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

  const columns = useMemo<Column<ChatRow>[]>(() => {
    const allColumns: Column<ChatRow>[] = [
      {
        key: 'title',
        name: 'Title',
        resizable: true,
        renderCell: ({ row }) => {
          const maxLength = isMobile ? 20 : 100;
          const displayTitle =
            row.title.length > maxLength
              ? `${row.title.slice(0, maxLength)}...`
              : row.title;

          return (
            <button
              type="button"
              className="text-left text-base font-semibold hover:underline focus:outline-none w-full py-2"
              onClick={() =>
                router.push(`/workspace/${workspaceId}/chat/${row.id}`)
              }
              title={row.title}
            >
              {displayTitle}
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
        name: 'Actions',
        width: 80,
        renderCell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="size-8 p-0 data-[state=open]:bg-muted"
              >
                <MoreHorizontalIcon className="size-4" />
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
        ),
      },
    ];

    // Filter columns based on viewport
    if (isMobile) {
      return allColumns.filter((col) =>
        ['title', 'messageCount'].includes(col.key),
      );
    }
    if (isTablet) {
      return allColumns.filter((col) =>
        ['title', 'createdAt', 'actions'].includes(col.key),
      );
    }
    return allColumns; // Desktop shows all
  }, [isMobile, isTablet, workspaceId, router]);

  return (
    <>
      <DataGrid
        columns={columns}
        rows={chats}
        rowKeyGetter={(row) => row.id}
        className="rdg-light dark:rdg-dark"
        style={{
          // Calculate height based on number of rows
          // Header is ~35px, each row is ~53px
          height: `${35 + chats.length * 53}px`,
          minHeight: '400px',
        }}
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
