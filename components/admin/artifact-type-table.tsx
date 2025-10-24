'use client';

import { useState } from 'react';
import { ArtifactCategory, type ArtifactType } from '@/lib/db/schema';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { ActionsDropdown } from './actions-dropdown';
import { DeleteConfirmationDialog } from './delete-confirmation-dialog';
import {
  cloneArtifactTypeAction,
  deleteArtifactTypeAction,
} from '@/app/admin/artifact-types/actions';
import { getCategoryDisplayName } from '@/lib/artifacts/utils';
import { useToast } from '@/hooks/use-toast';
import { getLogger } from '@/lib/logger';

const logger = getLogger('ArtifactTypeTable');

interface ArtifactTypeTableProps {
  artifactTypes: ArtifactType[];
}

export function ArtifactTypeTable({ artifactTypes }: ArtifactTypeTableProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [cloneDialog, setCloneDialog] = useState<{
    open: boolean;
    artifactType?: ArtifactType;
  }>({ open: false });
  const [cloneName, setCloneName] = useState('');
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    artifactType?: ArtifactType;
    usageCount?: number;
    usageDescription?: string;
  }>({ open: false });
  const [isLoading, setIsLoading] = useState(false);

  const truncateText = (text: string, maxLength: number) => {
    if (text.length <= maxLength) return text;
    return `${text.slice(0, maxLength)}...`;
  };

  const getCategoryBadge = (category: ArtifactType['category']) => {
    const variants: Record<string, string> = {
      [ArtifactCategory.OBJECTIVE]:
        'bg-primary/10 text-primary border-primary/20',
      [ArtifactCategory.SUMMARY]:
        'bg-green-500/10 text-green-700 border-green-200',
      [ArtifactCategory.OBJECTIVE_ACTIONS]:
        'bg-purple-500/10 text-purple-700 border-purple-200',
      [ArtifactCategory.WORKSPACE_CONTEXT]:
        'bg-orange-500/10 text-orange-700 border-orange-200',
      [ArtifactCategory.OBJECTIVE_CONTEXT]:
        'bg-blue-500/10 text-blue-700 border-blue-200',
    };

    return (
      <Badge variant="outline" className={variants[category]}>
        {getCategoryDisplayName(category)}
      </Badge>
    );
  };

  const handleClone = async () => {
    if (!cloneDialog.artifactType) return;

    setIsLoading(true);
    try {
      const result = await cloneArtifactTypeAction(
        cloneDialog.artifactType.id,
        cloneName.trim() || undefined,
      );

      toast({
        title: 'Success',
        description: 'Artifact type cloned successfully',
      });

      setCloneDialog({ open: false });
      setCloneName('');
      router.refresh();

      // Navigate to edit page for the cloned artifact type
      router.push(`/admin/artifact-types/${result.artifactTypeId}/edit`);
    } catch (error) {
      logger.error('Failed to clone artifact type', { error });
      toast({
        title: 'Error',
        description:
          error instanceof Error
            ? error.message
            : 'Failed to clone artifact type',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteDialog.artifactType) return;

    setIsLoading(true);
    try {
      await deleteArtifactTypeAction(deleteDialog.artifactType.id);

      toast({
        title: 'Success',
        description: 'Artifact type deleted successfully',
      });

      setDeleteDialog({ open: false });
      router.refresh();
    } catch (error) {
      logger.error('Failed to delete artifact type', { error });

      // Extract usage information from error message
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Failed to delete artifact type';

      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const openCloneDialog = (artifactType: ArtifactType) => {
    setCloneName(`Copy of ${artifactType.title}`);
    setCloneDialog({ open: true, artifactType });
  };

  const openDeleteDialog = (artifactType: ArtifactType) => {
    setDeleteDialog({ open: true, artifactType });
  };

  return (
    <div className="rounded-md border overflow-hidden">
      <table className="w-full">
        <thead className="bg-muted/50">
          <tr className="border-b">
            <th className="px-4 py-3 text-left text-sm font-medium">Title</th>
            <th className="px-4 py-3 text-left text-sm font-medium">
              Category
            </th>
            <th className="px-4 py-3 text-left text-sm font-medium">
              Description
            </th>
            <th className="px-4 py-3 text-left text-sm font-medium">Updated</th>
            <th className="px-4 py-3 text-left text-sm font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {artifactTypes.map((artifactType) => (
            <tr
              key={artifactType.id}
              className="border-b last:border-b-0 hover:bg-muted/30 transition-colors"
            >
              <td className="px-4 py-3">
                <Button
                  variant="link"
                  className="h-auto p-0 text-left font-medium justify-start"
                  onClick={() =>
                    router.push(`/admin/artifact-types/${artifactType.id}/edit`)
                  }
                >
                  {artifactType.title}
                </Button>
              </td>
              <td className="px-4 py-3">
                {getCategoryBadge(artifactType.category)}
              </td>
              <td className="px-4 py-3 text-sm text-muted-foreground max-w-md">
                {truncateText(artifactType.description, 100)}
              </td>
              <td className="px-4 py-3 text-sm text-muted-foreground">
                {formatDistanceToNow(new Date(artifactType.updatedAt), {
                  addSuffix: true,
                })}
              </td>
              <td className="px-4 py-3">
                <ActionsDropdown
                  onEdit={() =>
                    router.push(`/admin/artifact-types/${artifactType.id}/edit`)
                  }
                  onClone={() => openCloneDialog(artifactType)}
                  onDelete={() => openDeleteDialog(artifactType)}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Clone Dialog */}
      <Dialog
        open={cloneDialog.open}
        onOpenChange={(open) => {
          if (!isLoading) {
            setCloneDialog({ open });
            if (!open) setCloneName('');
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clone Artifact Type</DialogTitle>
            <DialogDescription>
              Create a copy of{' '}
              <span className="font-semibold">
                {cloneDialog.artifactType?.title}
              </span>
              . You can customize the name below.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="clone-name">Name</Label>
            <Input
              id="clone-name"
              value={cloneName}
              onChange={(e) => setCloneName(e.target.value)}
              placeholder="Enter artifact type name"
              disabled={isLoading}
              className="mt-1.5"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCloneDialog({ open: false });
                setCloneName('');
              }}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleClone}
              disabled={isLoading || !cloneName.trim()}
            >
              {isLoading ? 'Cloning...' : 'Clone'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      {deleteDialog.artifactType && (
        <DeleteConfirmationDialog
          open={deleteDialog.open}
          onOpenChange={(open) => {
            if (!isLoading) {
              setDeleteDialog({ open });
            }
          }}
          entityType="artifactType"
          entityName={deleteDialog.artifactType.title}
          onConfirm={handleDelete}
          isLoading={isLoading}
          usageCount={deleteDialog.usageCount}
          usageDescription={deleteDialog.usageDescription}
        />
      )}
    </div>
  );
}
