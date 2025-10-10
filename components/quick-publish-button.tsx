'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from './ui/button';
import { CheckCircle2Icon, UploadIcon } from 'lucide-react';
import {
  quickPublishDocumentAction,
  unpublishDocumentAction,
} from '@/lib/workspace/document-actions';
import useSWR from 'swr';
import { fetcher } from '@/lib/utils';
import type { DocumentWithVersions } from '@/lib/db/schema';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface QuickPublishButtonProps {
  documentEnvelopeId: string;
  workspaceId: string;
}

export function QuickPublishButton({
  documentEnvelopeId,
  workspaceId,
}: QuickPublishButtonProps) {
  const [publishing, setPublishing] = useState(false);

  // Fetch document envelope to check publish state
  const { data: docWithVersions, mutate } = useSWR<DocumentWithVersions | null>(
    `/api/workspace/${workspaceId}/document-envelope/${documentEnvelopeId}`,
    fetcher,
  );

  const isPublished = !!docWithVersions?.currentPublished;

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent click from bubbling to parent elements
    setPublishing(true);
    try {
      if (isPublished) {
        // Unpublish - Phase 2: removed workspaceId parameter
        await unpublishDocumentAction(documentEnvelopeId);
        toast.success('Document unpublished');
      } else {
        // Publish - Phase 2: quickPublishDocumentAction now takes (documentId, content)
        // This is deprecated code - passing empty content as stub
        await quickPublishDocumentAction(documentEnvelopeId, '');
        toast.success('Document published to workspace');
      }
      mutate(); // Refresh document data
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to update document',
      );
    } finally {
      setPublishing(false);
    }
  };

  const handleContainerClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent entire bar from triggering parent clicks
  };

  return (
    <div
      role="button"
      tabIndex={0}
      className="relative z-20 flex items-center justify-end px-4 py-2 border-t dark:border-zinc-700 rounded-b-2xl"
      onClick={handleContainerClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.stopPropagation();
        }
      }}
    >
      <TooltipProvider delayDuration={0}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="sm"
              onClick={handleClick}
              disabled={publishing}
              className={
                isPublished ? 'gap-2 bg-green-600 hover:bg-green-700' : 'gap-2'
              }
            >
              {publishing ? (
                <div className="animate-spin">
                  <UploadIcon className="size-3.5" />
                </div>
              ) : isPublished ? (
                <>
                  <CheckCircle2Icon className="size-3.5" />
                  Published
                </>
              ) : (
                <>
                  <UploadIcon className="size-3.5" />
                  Publish
                </>
              )}
            </Button>
          </TooltipTrigger>
          {isPublished && (
            <TooltipContent
              side="top"
              className="bg-foreground text-background rounded-md p-2 px-3"
            >
              Click to unpublish
            </TooltipContent>
          )}
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}
