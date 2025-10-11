'use client';

import { useMemo, useState } from 'react';
import DataGrid, { type Column } from 'react-data-grid';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { MoreHorizontalIcon, Eye, Trash } from 'lucide-react';
import { toast } from 'sonner';
import { useResponsiveColumns } from '@/hooks/use-responsive-columns';
import { useTableHeight } from '@/hooks/use-table-height';
import { Badge } from './ui/badge';
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
import type { KnowledgeDocument } from '@/lib/db/schema';
import 'react-data-grid/lib/styles.css';

interface KnowledgeTableProps {
  documents: KnowledgeDocument[];
  workspaceId: string;
  objectives?: Array<{ id: string; title: string }>;
}

export function KnowledgeTable({
  documents,
  workspaceId,
  objectives = [],
}: KnowledgeTableProps) {
  const router = useRouter();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const handleView = (docId: string) => {
    toast.info('Document viewer coming soon');
    // TODO: Navigate to document detail page when implemented
  };

  const handleDelete = async () => {
    if (!deleteId) return;

    toast.info('Delete functionality coming soon');
    setShowDeleteDialog(false);
    setDeleteId(null);
    // TODO: Call delete action when implemented
  };

  const allColumns = useMemo<Column<KnowledgeDocument>[]>(
    () => [
      {
        key: 'title',
        name: 'Title',
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
        key: 'objective',
        name: 'Objective',
        width: 200,
        renderCell: ({ row }) => {
          if (!row.objectiveId) {
            return (
              <span className="text-xs text-muted-foreground">
                Workspace-level
              </span>
            );
          }

          const objective = objectives.find(
            (obj) => obj.id === row.objectiveId,
          );
          const objectiveTitle = objective?.title || 'Unknown';

          return (
            <button
              type="button"
              className="text-left text-sm text-primary hover:underline focus:outline-none truncate transition-colors"
              onClick={() =>
                router.push(
                  `/workspace/${workspaceId}/objective/${row.objectiveId}`,
                )
              }
              title={objectiveTitle}
            >
              {objectiveTitle}
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
                  className="size-8 p-0 data-[state=open]:bg-muted hover:bg-muted/50 transition-colors"
                >
                  <MoreHorizontalIcon className="size-4" />
                  <span className="sr-only">Open menu</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem
                  className="cursor-pointer"
                  onClick={() => handleView(row.id)}
                >
                  <Eye className="mr-2 size-4" />
                  <span>View Document</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="cursor-pointer text-destructive focus:text-destructive"
                  onClick={() => {
                    setDeleteId(row.id);
                    setShowDeleteDialog(true);
                  }}
                >
                  <Trash className="mr-2 size-4" />
                  <span>Delete Document</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ),
      },
    ],
    [objectives, router, workspaceId],
  );

  // Apply responsive column filtering
  const columns = useResponsiveColumns(allColumns, {
    mobile: ['title', 'objective', 'actions'],
    tablet: ['title', 'objective', 'createdAt', 'actions'],
  });

  // Calculate dynamic table height
  const height = useTableHeight(documents.length);

  return (
    <>
      <DataGrid
        columns={columns}
        rows={documents}
        rowKeyGetter={(row) => row.id}
        className="rdg-light dark:rdg-dark [&_.rdg-row:hover]:bg-muted/50 [&_.rdg-row]:transition-colors [&_.rdg-cell]:py-2 [&_.rdg-header-row]:text-sm [&_.rdg-header-row]:font-bold"
        style={{ height }}
      />

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this document.
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
