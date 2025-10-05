'use client';

import { getLogger } from '@/lib/logger';

const logger = getLogger('workspace-dialogs');
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { z } from 'zod';
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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Workspace } from '@/lib/db/schema';
import useSWR from 'swr';
import { fetcher } from '@/lib/utils';

const createWorkspaceSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255, 'Name is too long'),
  description: z.string().max(1000, 'Description is too long').optional(),
});

interface CreateWorkspaceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (workspace: Workspace) => void;
}

export function CreateWorkspaceDialog({
  open,
  onOpenChange,
  onSuccess,
}: CreateWorkspaceDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [domainId, setDomainId] = useState<'sales' | 'meeting'>('sales');
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; description?: string }>(
    {},
  );

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (!open) {
      setName('');
      setDescription('');
      setDomainId('sales');
      setErrors({});
    }
  }, [open]);

  const handleSubmit = async () => {
    // Validate
    const result = createWorkspaceSchema.safeParse({ name, description });
    if (!result.success) {
      const fieldErrors: typeof errors = {};
      result.error.issues.forEach((issue) => {
        if (issue.path[0] === 'name') fieldErrors.name = issue.message;
        if (issue.path[0] === 'description')
          fieldErrors.description = issue.message;
      });
      setErrors(fieldErrors);
      return;
    }

    setIsLoading(true);
    setErrors({});

    try {
      const formData = new FormData();
      formData.append('name', name);
      if (description) {
        formData.append('description', description);
      }
      formData.append('domainId', domainId);

      const response = await fetch('/api/workspace/create', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create workspace');
      }

      const newWorkspace = await response.json();
      onSuccess(newWorkspace);
    } catch (error) {
      logger.error('Failed to create workspace:', error);
      toast.error(
        error instanceof Error ? error.message : 'Failed to create workspace',
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="sm:max-w-[425px]">
        <AlertDialogHeader>
          <AlertDialogTitle>Create New Workspace</AlertDialogTitle>
          <AlertDialogDescription>
            Give your workspace a name to help organize your projects.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="name">
              Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              placeholder="e.g., Personal, Work, Side Project"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isLoading}
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name}</p>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="domain">Domain</Label>
            <Select
              value={domainId}
              onValueChange={(value) =>
                setDomainId(value as 'sales' | 'meeting')
              }
              disabled={isLoading}
            >
              <SelectTrigger id="domain">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sales">Sales Intelligence</SelectItem>
                <SelectItem value="meeting">Meeting Intelligence</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea
              id="description"
              placeholder="What will you use this workspace for?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isLoading}
              rows={3}
            />
            {errors.description && (
              <p className="text-sm text-destructive">{errors.description}</p>
            )}
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
          <Button onClick={handleSubmit} disabled={isLoading || !name.trim()}>
            {isLoading ? 'Creating...' : 'Create'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

interface DeleteWorkspaceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspace: Workspace;
  onSuccess: (workspaceId: string) => void;
  isLastWorkspace: boolean;
}

interface WorkspaceStats {
  chatCount: number;
  documentCount: number;
}

export function DeleteWorkspaceDialog({
  open,
  onOpenChange,
  workspace,
  onSuccess,
  isLastWorkspace,
}: DeleteWorkspaceDialogProps) {
  const [confirmText, setConfirmText] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Fetch workspace stats when dialog opens
  const { data: stats } = useSWR<WorkspaceStats>(
    open ? `/api/workspace/${workspace.id}/stats` : null,
    fetcher,
  );

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (!open) {
      setConfirmText('');
    }
  }, [open]);

  const handleDelete = async () => {
    if (isLastWorkspace) {
      toast.error('Cannot delete your only workspace');
      return;
    }

    if (confirmText.toLowerCase() !== workspace.name.toLowerCase()) {
      toast.error('Please type the workspace name correctly');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(`/api/workspace/${workspace.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to delete workspace');
      }

      onSuccess(workspace.id);
    } catch (error) {
      logger.error('Failed to delete workspace:', error);
      toast.error(
        error instanceof Error ? error.message : 'Failed to delete workspace',
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (isLastWorkspace) {
    return (
      <AlertDialog open={open} onOpenChange={onOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cannot Delete Workspace</AlertDialogTitle>
            <AlertDialogDescription>
              This is your only workspace. Create a new workspace before
              deleting this one.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => onOpenChange(false)}>
              Understood
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete the
            &quot;{workspace.name}&quot; workspace.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {stats && (stats.chatCount > 0 || stats.documentCount > 0) && (
          <div className="text-sm text-muted-foreground">
            This workspace includes:
            <ul className="mt-2 list-disc list-inside">
              {stats.chatCount > 0 && (
                <li>
                  {stats.chatCount} chat{stats.chatCount !== 1 ? 's' : ''}
                </li>
              )}
              {stats.documentCount > 0 && (
                <li>
                  {stats.documentCount} document
                  {stats.documentCount !== 1 ? 's' : ''}
                </li>
              )}
            </ul>
          </div>
        )}

        <div className="my-4">
          <Label htmlFor="confirm">
            Type <span className="font-semibold">{workspace.name}</span> to
            confirm:
          </Label>
          <Input
            id="confirm"
            className="mt-2"
            placeholder={workspace.name}
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            disabled={isLoading}
          />
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={
              isLoading ||
              confirmText.toLowerCase() !== workspace.name.toLowerCase()
            }
          >
            {isLoading ? 'Deleting...' : 'Delete Workspace'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
