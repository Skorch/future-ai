'use client';

import { useMemo, useState, useCallback } from 'react';
import DataGrid, { type Column } from 'react-data-grid';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { useWindowSize } from 'usehooks-ts';
import { toast } from 'sonner';
import { DocumentTypeBadge } from './document-type-badge';
import { DocumentByteSize } from './document-byte-size';
import {
  MoreHorizontalIcon,
  Edit,
  Trash,
  Check,
  X,
  Search,
  SearchX,
  FileX,
} from 'lucide-react';
import {
  toggleDocumentSearchableAction,
  unpublishDocumentAction,
} from '@/lib/workspace/document-actions';
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
import 'react-data-grid/lib/styles.css';

interface DocumentRow {
  id: string;
  title: string;
  metadata: { documentType?: string } | null;
  createdAt: Date;
  contentLength: number;
  isSearchable: boolean;
}

interface DocumentTableProps {
  documents: DocumentRow[];
  workspaceId: string;
  onDocumentDeleted?: () => void;
}

export function DocumentTable({
  documents,
  workspaceId,
  onDocumentDeleted,
}: DocumentTableProps) {
  const router = useRouter();
  const { width } = useWindowSize();
  const [deleteDialogDoc, setDeleteDialogDoc] = useState<{
    id: string;
    title: string;
  } | null>(null);

  // Responsive breakpoints
  const isMobile = width < 640;
  const isTablet = width >= 640 && width < 1024;
  const isDesktop = width >= 1024;

  // Delete handler
  const handleDelete = async (doc: { id: string; title: string }) => {
    const promise = fetch(
      `/api/workspace/${workspaceId}/document/${doc.id}/delete`,
      { method: 'POST' },
    );

    toast.promise(promise, {
      loading: 'Deleting document...',
      success: () => {
        // Trigger parent callback to revalidate
        onDocumentDeleted?.();
        return 'Document deleted successfully';
      },
      error: 'Failed to delete document',
    });

    setDeleteDialogDoc(null);
  };

  // Toggle searchable handler
  const handleToggleSearchable = useCallback(
    async (doc: { id: string; title: string; isSearchable: boolean }) => {
      const promise = toggleDocumentSearchableAction(doc.id, workspaceId);

      toast.promise(promise, {
        loading: doc.isSearchable
          ? 'Removing from Knowledge Base...'
          : 'Adding to Knowledge Base...',
        success: () => {
          onDocumentDeleted?.(); // Revalidate list
          return doc.isSearchable
            ? `"${doc.title}" removed from Knowledge Base`
            : `"${doc.title}" added to Knowledge Base`;
        },
        error: 'Failed to update document',
      });
    },
    [workspaceId, onDocumentDeleted],
  );

  // Unpublish handler
  const handleUnpublish = useCallback(
    async (doc: { id: string; title: string }) => {
      // PHASE 4 REFACTORING: Unpublish action signature will be updated
      const promise = unpublishDocumentAction(doc.id);

      toast.promise(promise, {
        loading: 'Unpublishing document...',
        success: () => {
          onDocumentDeleted?.(); // Revalidate - will remove from published list
          return `"${doc.title}" unpublished`;
        },
        error: 'Failed to unpublish document',
      });
    },
    [workspaceId, onDocumentDeleted],
  );

  const columns = useMemo<Column<DocumentRow>[]>(() => {
    const allColumns: Column<DocumentRow>[] = [
      {
        key: 'title',
        name: 'Title',
        resizable: true,
        renderCell: ({ row }) => (
          <button
            type="button"
            className="text-left text-base font-semibold hover:underline focus:outline-none w-full py-2"
            onClick={() =>
              router.push(`/workspace/${workspaceId}/document/${row.id}`)
            }
          >
            {row.title}
          </button>
        ),
      },
      {
        key: 'type',
        name: 'Type',
        width: 180,
        renderCell: ({ row }) => (
          <div className="py-2">
            <DocumentTypeBadge type={row.metadata?.documentType || 'text'} />
          </div>
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
        key: 'contentLength',
        name: 'Byte Size',
        width: 120,
        renderCell: ({ row }) => (
          <DocumentByteSize
            bytes={row.contentLength}
            className="text-sm py-2 block"
          />
        ),
      },
      {
        key: 'isSearchable',
        name: 'In KB',
        width: 80,
        renderCell: ({ row }) => (
          <div className="flex items-center justify-center py-2">
            {row.isSearchable ? (
              <Check className="size-4 text-green-600 dark:text-green-500" />
            ) : (
              <X className="size-4 text-gray-400 dark:text-gray-600" />
            )}
          </div>
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
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem
                onClick={() =>
                  router.push(`/workspace/${workspaceId}/document/${row.id}`)
                }
              >
                <Edit className="mr-2 size-4" />
                <span>View Document</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() =>
                  router.push(
                    `/workspace/${workspaceId}/document/${row.id}/edit`,
                  )
                }
              >
                <Edit className="mr-2 size-4" />
                <span>Edit Draft</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() =>
                  handleToggleSearchable({
                    id: row.id,
                    title: row.title,
                    isSearchable: row.isSearchable,
                  })
                }
              >
                {row.isSearchable ? (
                  <>
                    <SearchX className="mr-2 size-4" />
                    <span>Remove from KB</span>
                  </>
                ) : (
                  <>
                    <Search className="mr-2 size-4" />
                    <span>Add to KB</span>
                  </>
                )}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() =>
                  handleUnpublish({ id: row.id, title: row.title })
                }
              >
                <FileX className="mr-2 size-4" />
                <span>Unpublish</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() =>
                  setDeleteDialogDoc({ id: row.id, title: row.title })
                }
              >
                <Trash className="mr-2 size-4" />
                <span>Delete</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ];

    // Filter columns based on viewport
    if (isMobile) {
      return allColumns.filter((col) =>
        ['title', 'isSearchable', 'actions'].includes(col.key),
      );
    }
    if (isTablet) {
      return allColumns.filter((col) =>
        ['title', 'type', 'isSearchable', 'actions'].includes(col.key),
      );
    }
    return allColumns; // Desktop shows all
  }, [
    isMobile,
    isTablet,
    workspaceId,
    router,
    handleToggleSearchable,
    handleUnpublish,
  ]);

  return (
    <>
      <DataGrid
        columns={columns}
        rows={documents}
        rowKeyGetter={(row) => row.id}
        className="rdg-light dark:rdg-dark"
        style={{
          // Calculate height based on number of rows
          // Header is ~35px, each row is ~53px (based on py-2 padding)
          height: `${35 + documents.length * 53}px`,
          minHeight: '400px',
        }}
      />

      <AlertDialog
        open={!!deleteDialogDoc}
        onOpenChange={(open) => !open && setDeleteDialogDoc(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Document</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &ldquo;{deleteDialogDoc?.title}
              &rdquo;? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteDialogDoc && handleDelete(deleteDialogDoc)}
            >
              Delete Document
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
