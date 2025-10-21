'use client';

import { useState, useMemo } from 'react';
import DataGrid, { type Column } from 'react-data-grid';
import 'react-data-grid/lib/styles.css';
import { formatDistanceToNow } from 'date-fns';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { deletePlaybook } from '@/app/admin/playbooks/actions';
import type { AdminPlaybook } from '@/lib/db/queries/admin/playbooks';

interface PlaybookTableProps {
  playbooks: AdminPlaybook[];
  onUpdate: () => void;
}

export function PlaybookTable({ playbooks, onUpdate }: PlaybookTableProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [playbookToDelete, setPlaybookToDelete] =
    useState<AdminPlaybook | null>(null);

  const handleDelete = async () => {
    if (!playbookToDelete) return;

    try {
      const result = await deletePlaybook(playbookToDelete.id);
      if (result) {
        toast({
          title: 'Playbook deleted',
          description: `${playbookToDelete.name} has been deleted.`,
        });
        onUpdate();
      } else {
        toast({
          title: 'Error',
          description: 'Failed to delete playbook.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'An error occurred while deleting the playbook.',
        variant: 'destructive',
      });
    } finally {
      setDeleteDialogOpen(false);
      setPlaybookToDelete(null);
    }
  };

  const columns: Column<AdminPlaybook>[] = useMemo(
    () => [
      {
        key: 'name',
        name: 'Name',
        resizable: true,
        renderCell: ({ row }) => (
          <Button
            variant="link"
            className="h-auto p-0 text-left font-normal justify-start"
            onClick={() => router.push(`/admin/playbooks/${row.id}/edit`)}
          >
            {row.name}
          </Button>
        ),
      },
      {
        key: 'description',
        name: 'Description',
        resizable: true,
        renderCell: ({ row }) => (
          <span className="text-sm text-muted-foreground line-clamp-2">
            {row.description || '—'}
          </span>
        ),
      },
      {
        key: 'domains',
        name: 'Domains',
        renderCell: ({ row }: { row: AdminPlaybook }) => (
          <div className="flex flex-wrap gap-1">
            {row.domains.map((domain) => (
              <Badge key={domain.id} variant="secondary">
                {domain.title}
              </Badge>
            ))}
          </div>
        ),
      },
      {
        key: 'createdAt',
        name: 'Created',
        width: 150,
        renderCell: ({ row }) => (
          <span className="text-sm">
            {formatDistanceToNow(new Date(row.createdAt), {
              addSuffix: true,
            })}
          </span>
        ),
      },
      {
        key: 'steps',
        name: 'Steps',
        width: 100,
        renderCell: ({ row }: { row: AdminPlaybook }) => (
          <span className="text-sm">{row.steps.length}</span>
        ),
      },
      {
        key: 'actions',
        name: 'Actions',
        width: 80,
        renderCell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="size-8 p-0">
                <MoreHorizontal className="size-4" />
                <span className="sr-only">Open menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => router.push(`/admin/playbooks/${row.id}/edit`)}
              >
                <Pencil className="mr-2 size-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  setPlaybookToDelete(row);
                  setDeleteDialogOpen(true);
                }}
                className="text-destructive"
              >
                <Trash2 className="mr-2 size-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [router],
  );

  const rowHeight = 52;
  const headerHeight = 40;
  const gridHeight = Math.min(headerHeight + playbooks.length * rowHeight, 600);

  return (
    <>
      <div className="rdg-light dark:rdg-dark">
        <DataGrid
          columns={columns}
          rows={playbooks}
          rowKeyGetter={(row) => row.id}
          style={{ height: gridHeight }}
          className="border rounded-md"
          rowHeight={rowHeight}
          headerRowHeight={headerHeight}
        />
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Playbook</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{playbookToDelete?.name}
              &quot;? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
