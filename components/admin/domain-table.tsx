'use client';

import { useState } from 'react';
import type { DomainWithRelations } from '@/lib/db/schema';
import { ArtifactCategory } from '@/lib/db/schema';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { ActionsDropdown } from './actions-dropdown';
import { CloneDomainDialog } from './clone-domain-dialog';
import { DeleteConfirmationDialog } from './delete-confirmation-dialog';
import { DefaultDomainBadge } from './default-domain-badge';
import {
  cloneDomainAction,
  deleteDomainAction,
  setDefaultDomainAction,
} from '@/app/admin/domains/actions';
import { useToast } from '@/hooks/use-toast';
import { getLogger } from '@/lib/logger';

const logger = getLogger('DomainTable');

interface DomainWithMetadata extends DomainWithRelations {
  workspaceCount: number;
  artifactTypes: Array<{ id: string; name: string; category: string }>;
}

interface DomainTableProps {
  domains: DomainWithMetadata[];
}

export function DomainTable({ domains }: DomainTableProps) {
  const router = useRouter();
  const { toast } = useToast();

  const [cloneDialog, setCloneDialog] = useState<{
    open: boolean;
    domain?: DomainWithMetadata;
  }>({ open: false });

  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    domain?: DomainWithMetadata;
  }>({ open: false });

  const [isLoading, setIsLoading] = useState(false);

  const truncateText = (text: string, maxLength: number) => {
    if (text.length <= maxLength) return text;
    return `${text.slice(0, maxLength)}...`;
  };

  const countArtifactTypes = () => {
    // Domain has 5 artifact type references:
    // defaultObjectiveArtifactTypeId, defaultSummaryArtifactTypeId,
    // defaultObjectiveActionsArtifactTypeId, defaultWorkspaceContextArtifactTypeId,
    // defaultObjectiveContextArtifactTypeId
    return 5;
  };

  const handleClone = async (
    newName: string,
    artifactTypeNames: Record<string, string>,
  ) => {
    if (!cloneDialog.domain) return;

    setIsLoading(true);
    try {
      // Map simplified categories to full property names expected by cloneDomain
      const mappedNames: Record<string, string> = {
        defaultObjectiveArtifactType:
          artifactTypeNames[ArtifactCategory.OBJECTIVE] ||
          artifactTypeNames.defaultObjectiveArtifactType ||
          '',
        defaultSummaryArtifactType:
          artifactTypeNames[ArtifactCategory.SUMMARY] ||
          artifactTypeNames.defaultSummaryArtifactType ||
          '',
        defaultObjectiveActionsArtifactType:
          artifactTypeNames[ArtifactCategory.OBJECTIVE_ACTIONS] ||
          artifactTypeNames.defaultObjectiveActionsArtifactType ||
          '',
        defaultWorkspaceContextArtifactType:
          artifactTypeNames[ArtifactCategory.WORKSPACE_CONTEXT] ||
          artifactTypeNames.defaultWorkspaceContextArtifactType ||
          '',
        defaultObjectiveContextArtifactType:
          artifactTypeNames[ArtifactCategory.OBJECTIVE_CONTEXT] ||
          artifactTypeNames.defaultObjectiveContextArtifactType ||
          '',
      };

      const result = await cloneDomainAction(
        cloneDialog.domain.id,
        newName,
        mappedNames,
      );

      toast({
        title: 'Domain cloned',
        description: `Successfully created "${newName}"`,
      });

      setCloneDialog({ open: false });
      router.refresh();

      logger.info('Domain cloned successfully', {
        sourceDomainId: cloneDialog.domain.id,
        newDomainId: result.domainId,
      });
    } catch (error) {
      logger.error('Failed to clone domain', { error });
      toast({
        title: 'Clone failed',
        description:
          error instanceof Error ? error.message : 'Failed to clone domain',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (reassignToDefault = false) => {
    if (!deleteDialog.domain) return;

    setIsLoading(true);
    try {
      await deleteDomainAction(deleteDialog.domain.id, reassignToDefault);

      toast({
        title: 'Domain deleted',
        description: `Successfully deleted "${deleteDialog.domain.title}"`,
      });

      setDeleteDialog({ open: false });
      router.refresh();

      logger.info('Domain deleted successfully', {
        domainId: deleteDialog.domain.id,
      });
    } catch (error) {
      logger.error('Failed to delete domain', { error });
      toast({
        title: 'Delete failed',
        description:
          error instanceof Error ? error.message : 'Failed to delete domain',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSetDefault = async (domainId: string) => {
    setIsLoading(true);
    try {
      await setDefaultDomainAction(domainId);

      toast({
        title: 'Default domain updated',
        description: 'Successfully set as default domain',
      });

      router.refresh();

      logger.info('Default domain set successfully', { domainId });
    } catch (error) {
      logger.error('Failed to set default domain', { error });
      toast({
        title: 'Update failed',
        description:
          error instanceof Error
            ? error.message
            : 'Failed to set default domain',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="rounded-md border overflow-hidden">
      <table className="w-full">
        <thead className="bg-muted/50">
          <tr className="border-b">
            <th className="px-4 py-3 text-left text-sm font-medium">Title</th>
            <th className="px-4 py-3 text-left text-sm font-medium">
              Description
            </th>
            <th className="px-4 py-3 text-left text-sm font-medium">
              Artifact Types
            </th>
            <th className="px-4 py-3 text-left text-sm font-medium">Updated</th>
            <th className="px-4 py-3 text-left text-sm font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {domains.map((domain) => (
            <tr
              key={domain.id}
              className="border-b last:border-b-0 hover:bg-muted/30 transition-colors"
            >
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <Button
                    variant="link"
                    className="h-auto p-0 text-left font-medium justify-start"
                    onClick={() =>
                      router.push(`/admin/domains/${domain.id}/edit`)
                    }
                  >
                    {domain.title}
                  </Button>
                  <DefaultDomainBadge isDefault={domain.isDefault} />
                </div>
              </td>
              <td className="px-4 py-3 text-sm text-muted-foreground max-w-md">
                {truncateText(domain.description, 100)}
              </td>
              <td className="px-4 py-3">
                <Badge variant="secondary">{countArtifactTypes()}</Badge>
              </td>
              <td className="px-4 py-3 text-sm text-muted-foreground">
                {formatDistanceToNow(new Date(domain.updatedAt), {
                  addSuffix: true,
                })}
              </td>
              <td className="px-4 py-3">
                <ActionsDropdown
                  onEdit={() => router.push(`/admin/domains/${domain.id}/edit`)}
                  onClone={() => setCloneDialog({ open: true, domain })}
                  onDelete={() => setDeleteDialog({ open: true, domain })}
                  onSetDefault={
                    !domain.isDefault
                      ? () => handleSetDefault(domain.id)
                      : undefined
                  }
                  showSetDefault={!domain.isDefault}
                  deleteDisabled={domain.isDefault}
                  deleteTooltip={
                    domain.isDefault
                      ? 'Cannot delete the default domain'
                      : undefined
                  }
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Clone Dialog */}
      {cloneDialog.domain && (
        <CloneDomainDialog
          open={cloneDialog.open}
          onOpenChange={(open) => setCloneDialog({ open, domain: undefined })}
          domain={cloneDialog.domain}
          artifactTypes={cloneDialog.domain.artifactTypes}
          onClone={handleClone}
          isLoading={isLoading}
        />
      )}

      {/* Delete Dialog */}
      {deleteDialog.domain && (
        <DeleteConfirmationDialog
          open={deleteDialog.open}
          onOpenChange={(open) => setDeleteDialog({ open, domain: undefined })}
          entityType="domain"
          entityName={deleteDialog.domain.title}
          onConfirm={handleDelete}
          isLoading={isLoading}
          workspaceCount={deleteDialog.domain.workspaceCount}
          canReassignToDefault={!deleteDialog.domain.isDefault}
          isDefaultDomain={deleteDialog.domain.isDefault}
        />
      )}
    </div>
  );
}
