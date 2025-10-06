'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from './ui/button';
import { UploadIcon } from 'lucide-react';
import { quickPublishDocumentAction } from '@/lib/workspace/document-actions';

interface QuickPublishButtonProps {
  documentEnvelopeId: string;
  workspaceId: string;
}

export function QuickPublishButton({
  documentEnvelopeId,
  workspaceId,
}: QuickPublishButtonProps) {
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState(false);

  if (published) {
    return null; // Hide button after publishing
  }

  const handlePublish = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent click from bubbling to parent elements
    setPublishing(true);
    try {
      const result = await quickPublishDocumentAction(
        documentEnvelopeId,
        workspaceId,
      );
      if (result.success) {
        toast.success('Document published to workspace');
        setPublished(true);
      } else {
        toast.error(result.error || 'Failed to publish document');
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to publish document',
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
      className="relative z-20 flex items-center justify-end px-4 py-2 border-t dark:border-zinc-700 bg-muted/30 rounded-b-2xl"
      onClick={handleContainerClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.stopPropagation();
        }
      }}
    >
      <Button
        size="sm"
        onClick={handlePublish}
        disabled={publishing}
        className="gap-2"
      >
        <UploadIcon className="w-3.5 h-3.5" />
        {publishing ? 'Publishing...' : 'Publish'}
      </Button>
    </div>
  );
}
