'use client';

import { useMemo } from 'react';
import DataGrid, { type Column } from 'react-data-grid';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { useWindowSize } from 'usehooks-ts';
import { DocumentTypeBadge } from './document-type-badge';
import { DocumentByteSize } from './document-byte-size';
import { MoreHorizontalIcon, Edit, Trash } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { Button } from './ui/button';
import 'react-data-grid/lib/styles.css';

interface DocumentRow {
  id: string;
  title: string;
  metadata: { documentType?: string } | null;
  createdAt: Date;
  contentLength: number;
}

interface DocumentTableProps {
  documents: DocumentRow[];
  workspaceId: string;
}

export function DocumentTable({ documents, workspaceId }: DocumentTableProps) {
  const router = useRouter();
  const { width } = useWindowSize();

  // Responsive breakpoints
  const isMobile = width < 640;
  const isTablet = width >= 640 && width < 1024;
  const isDesktop = width >= 1024;

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
        key: 'actions',
        name: 'Actions',
        width: 80,
        renderCell: () => (
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
                disabled
                className="cursor-not-allowed opacity-50"
              >
                <Edit className="mr-2 size-4" />
                <span>Edit Document</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                disabled
                className="cursor-not-allowed opacity-50 text-destructive focus:text-destructive"
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
        ['title', 'contentLength'].includes(col.key),
      );
    }
    if (isTablet) {
      return allColumns.filter((col) =>
        ['title', 'type', 'actions'].includes(col.key),
      );
    }
    return allColumns; // Desktop shows all
  }, [isMobile, isTablet, workspaceId, router]);

  return (
    <div className="h-[calc(100vh-200px)]">
      <DataGrid
        columns={columns}
        rows={documents}
        rowKeyGetter={(row) => row.id}
        className="rdg-light dark:rdg-dark"
      />
    </div>
  );
}
