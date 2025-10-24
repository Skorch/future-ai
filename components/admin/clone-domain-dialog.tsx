'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getCategoryDisplayName } from '@/lib/artifacts/utils';
import { ArtifactCategory } from '@/lib/db/schema';

interface CloneDomainDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  domain: {
    id: string;
    title: string;
    defaultObjectiveArtifactTypeId: string;
    defaultSummaryArtifactTypeId: string;
    defaultObjectiveActionsArtifactTypeId: string;
    defaultWorkspaceContextArtifactTypeId: string;
    defaultObjectiveContextArtifactTypeId: string;
  };
  artifactTypes: Array<{
    id: string;
    name: string;
    category: string;
  }>;
  onClone: (
    newDomainName: string,
    artifactTypeNames: Record<string, string>,
  ) => Promise<void>;
  isLoading?: boolean;
}

export function CloneDomainDialog({
  open,
  onOpenChange,
  domain,
  artifactTypes,
  onClone,
  isLoading = false,
}: CloneDomainDialogProps) {
  const [newDomainName, setNewDomainName] = useState('');
  const [artifactTypeNames, setArtifactTypeNames] = useState<
    Record<string, string>
  >({});
  const [hasManualEdits, setHasManualEdits] = useState<Record<string, boolean>>(
    {},
  );

  // Map artifact type IDs to their categories and original names
  const artifactTypeMap = new Map(
    artifactTypes.map((at) => [
      at.id,
      { category: at.category, name: at.name },
    ]),
  );

  const domainArtifactTypes = [
    {
      id: domain.defaultObjectiveArtifactTypeId,
      category: ArtifactCategory.OBJECTIVE,
    },
    {
      id: domain.defaultSummaryArtifactTypeId,
      category: ArtifactCategory.SUMMARY,
    },
    {
      id: domain.defaultObjectiveActionsArtifactTypeId,
      category: ArtifactCategory.OBJECTIVE_ACTIONS,
    },
    {
      id: domain.defaultWorkspaceContextArtifactTypeId,
      category: ArtifactCategory.WORKSPACE_CONTEXT,
    },
    {
      id: domain.defaultObjectiveContextArtifactTypeId,
      category: ArtifactCategory.OBJECTIVE_CONTEXT,
    },
  ];

  // Initialize artifact type names when dialog opens
  useEffect(() => {
    if (open) {
      const initialNames: Record<string, string> = {};
      const initialEdits: Record<string, boolean> = {};

      for (const { id, category } of domainArtifactTypes) {
        const artifactType = artifactTypeMap.get(id);
        if (artifactType) {
          initialNames[category] = artifactType.name;
          initialEdits[category] = false;
        }
      }

      setArtifactTypeNames(initialNames);
      setHasManualEdits(initialEdits);
      setNewDomainName('');
    }
  }, [open, domain.id]);

  // Auto-generate names when domain name changes
  useEffect(() => {
    if (newDomainName) {
      const updatedNames: Record<string, string> = {};

      for (const { category } of domainArtifactTypes) {
        // Only auto-update if user hasn't manually edited this field
        if (!hasManualEdits[category]) {
          const friendlyName = getCategoryDisplayName(category);
          updatedNames[category] = `${newDomainName} - ${friendlyName}`;
        } else {
          // Keep the existing manual value
          updatedNames[category] = artifactTypeNames[category];
        }
      }

      setArtifactTypeNames(updatedNames);
    }
  }, [newDomainName]);

  const handleArtifactTypeNameChange = (category: string, value: string) => {
    setArtifactTypeNames((prev) => ({ ...prev, [category]: value }));
    setHasManualEdits((prev) => ({ ...prev, [category]: true }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newDomainName.trim()) {
      return;
    }

    await onClone(newDomainName.trim(), artifactTypeNames);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[525px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Clone Domain</DialogTitle>
            <DialogDescription>
              Create a copy of &ldquo;{domain.title}&rdquo; with new artifact
              types.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="domain-name">New Domain Name</Label>
              <Input
                id="domain-name"
                value={newDomainName}
                onChange={(e) => setNewDomainName(e.target.value)}
                placeholder="Enter new domain name"
                required
                disabled={isLoading}
              />
            </div>

            <div className="grid gap-4">
              <Label className="text-sm text-muted-foreground">
                Artifact Type Names
              </Label>

              {domainArtifactTypes.map(({ category }) => {
                const friendlyName = getCategoryDisplayName(category);

                return (
                  <div key={category} className="grid gap-2">
                    <Label htmlFor={`artifact-${category}`}>
                      {friendlyName}
                    </Label>
                    <Input
                      id={`artifact-${category}`}
                      value={artifactTypeNames[category] || ''}
                      onChange={(e) =>
                        handleArtifactTypeNameChange(category, e.target.value)
                      }
                      placeholder={`${friendlyName} artifact type name`}
                      required
                      disabled={isLoading}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading || !newDomainName.trim()}>
              {isLoading ? 'Cloning...' : 'Clone Domain'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
