'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { AlertCircle } from 'lucide-react';

interface DeleteConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityType: 'domain' | 'artifactType' | 'playbook';
  entityName: string;
  onConfirm: (reassignToDefault?: boolean) => Promise<void>;
  isLoading?: boolean;

  // Domain-specific options
  workspaceCount?: number;
  canReassignToDefault?: boolean;
  isDefaultDomain?: boolean;

  // Artifact type-specific options
  usageCount?: number;
  usageDescription?: string;
}

export function DeleteConfirmationDialog({
  open,
  onOpenChange,
  entityType,
  entityName,
  onConfirm,
  isLoading = false,
  workspaceCount = 0,
  canReassignToDefault = false,
  isDefaultDomain = false,
  usageCount = 0,
  usageDescription,
}: DeleteConfirmationDialogProps) {
  const [reassignToDefault, setReassignToDefault] = useState(false);

  const handleConfirm = async () => {
    await onConfirm(reassignToDefault);
  };

  const getEntityTypeLabel = () => {
    switch (entityType) {
      case 'domain':
        return 'domain';
      case 'artifactType':
        return 'artifact type';
      case 'playbook':
        return 'playbook';
    }
  };

  const isBlocked = () => {
    // Block deletion of default domains
    if (entityType === 'domain' && isDefaultDomain) {
      return true;
    }

    // Block deletion of artifact types in use
    if (entityType === 'artifactType' && usageCount > 0) {
      return true;
    }

    return false;
  };

  const getBlockingMessage = () => {
    if (entityType === 'domain' && isDefaultDomain) {
      return 'Cannot delete the default domain. Please designate a different domain as default before deleting this one.';
    }

    if (entityType === 'artifactType' && usageCount > 0) {
      return `This artifact type is currently in use${usageDescription ? ` ${usageDescription}` : ''}. Please remove all usages before deleting.`;
    }

    return null;
  };

  const showReassignmentOption =
    entityType === 'domain' && workspaceCount > 0 && canReassignToDefault;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete {getEntityTypeLabel()}</DialogTitle>
          <DialogDescription>
            {isBlocked() ? (
              <div className="flex gap-2 items-start mt-2 p-3 rounded-md bg-destructive/10 text-destructive">
                <AlertCircle className="size-5 shrink-0 mt-0.5" />
                <span className="text-sm">{getBlockingMessage()}</span>
              </div>
            ) : (
              <>
                Are you sure you want to delete{' '}
                <span className="font-semibold">{entityName}</span>? This action
                cannot be undone.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        {!isBlocked() && showReassignmentOption && (
          <div className="flex items-start space-x-2 py-4">
            <Checkbox
              id="reassign-workspaces"
              checked={reassignToDefault}
              onCheckedChange={(checked) =>
                setReassignToDefault(checked === true)
              }
              disabled={isLoading}
            />
            <div className="grid gap-1.5 leading-none">
              <Label
                htmlFor="reassign-workspaces"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
              >
                Reassign {workspaceCount}{' '}
                {workspaceCount === 1 ? 'workspace' : 'workspaces'} to default
                domain
              </Label>
              <p className="text-sm text-muted-foreground">
                Existing workspaces will be moved to the default domain instead
                of being deleted.
              </p>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          {!isBlocked() && (
            <Button
              variant="destructive"
              onClick={handleConfirm}
              disabled={isLoading}
            >
              {isLoading ? 'Deleting...' : 'Delete'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
