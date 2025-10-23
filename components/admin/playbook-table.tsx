'use client';

import { useState } from 'react';
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

  const truncateText = (text: string, maxLength: number) => {
    if (text.length <= maxLength) return text;
    return `${text.slice(0, maxLength)}...`;
  };

  return (
    <>
      <div className="rounded-md border overflow-hidden">
        <table className="w-full">
          <thead className="bg-muted/50">
            <tr className="border-b">
              <th className="px-4 py-3 text-left text-sm font-medium">Name</th>
              <th className="px-4 py-3 text-left text-sm font-medium">
                Description
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium">
                Domains
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium">Steps</th>
              <th className="px-4 py-3 text-left text-sm font-medium">
                Created
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {playbooks.map((playbook) => (
              <tr
                key={playbook.id}
                className="border-b last:border-b-0 hover:bg-muted/30 transition-colors"
              >
                <td className="px-4 py-3 font-medium">
                  <Button
                    variant="link"
                    className="h-auto p-0 text-left font-medium justify-start"
                    onClick={() =>
                      router.push(`/admin/playbooks/${playbook.id}/edit`)
                    }
                  >
                    {playbook.name}
                  </Button>
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground max-w-md">
                  {playbook.description
                    ? truncateText(playbook.description, 100)
                    : '—'}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {playbook.domains.map((domain) => (
                      <Badge key={domain.id} variant="secondary">
                        {domain.title}
                      </Badge>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3 text-sm">{playbook.steps.length}</td>
                <td className="px-4 py-3 text-sm text-muted-foreground">
                  {formatDistanceToNow(new Date(playbook.createdAt), {
                    addSuffix: true,
                  })}
                </td>
                <td className="px-4 py-3">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="size-8 p-0">
                        <MoreHorizontal className="size-4" />
                        <span className="sr-only">Open menu</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() =>
                          router.push(`/admin/playbooks/${playbook.id}/edit`)
                        }
                      >
                        <Pencil className="mr-2 size-4" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => {
                          setPlaybookToDelete(playbook);
                          setDeleteDialogOpen(true);
                        }}
                        className="text-destructive"
                      >
                        <Trash2 className="mr-2 size-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
