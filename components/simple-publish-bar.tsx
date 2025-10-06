'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import { Label } from './ui/label';
import { CheckCircle2Icon, UploadIcon } from 'lucide-react';
import {
  publishDocumentAction,
  quickPublishDocumentAction,
} from '@/lib/workspace/document-actions';

interface SimplePublishBarProps {
  documentEnvelopeId: string;
  versionId?: string; // Optional - will use quickPublish if not provided
  isPublished: boolean;
  isSearchable: boolean;
  workspaceId: string;
}

export function SimplePublishBar({
  documentEnvelopeId,
  versionId,
  isPublished,
  isSearchable,
  workspaceId,
}: SimplePublishBarProps) {
  const [publishing, setPublishing] = useState(false);
  const [localPublished, setLocalPublished] = useState(isPublished);
  const [makeSearchable, setMakeSearchable] = useState(isSearchable ?? true);

  if (localPublished) {
    return (
      <div className="relative z-20 flex items-center gap-2 px-3 py-2 text-sm border-t bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300">
        <CheckCircle2Icon className="w-4 h-4" />
        <span>Published to workspace</span>
        {isSearchable && <span>• Searchable</span>}
      </div>
    );
  }

  const handlePublish = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent click from bubbling to parent elements
    setPublishing(true);
    try {
      if (versionId) {
        // Use specific version publish
        await publishDocumentAction(
          documentEnvelopeId,
          versionId,
          makeSearchable,
          workspaceId,
        );
      } else {
        // Use quick publish (auto-discovers active draft)
        const result = await quickPublishDocumentAction(
          documentEnvelopeId,
          workspaceId,
        );
        if (!result.success) {
          throw new Error(result.error || 'Failed to publish');
        }
      }
      toast.success('Document published successfully');
      setLocalPublished(true);
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
      className="relative z-20 flex items-center justify-between px-3 py-2 border-t bg-muted/30"
      onClick={handleContainerClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.stopPropagation();
        }
      }}
    >
      <div className="flex items-center gap-2">
        <Checkbox
          id={`searchable-${documentEnvelopeId}`}
          checked={makeSearchable}
          onCheckedChange={(checked) => setMakeSearchable(checked === true)}
          disabled={publishing}
        />
        <Label
          htmlFor={`searchable-${documentEnvelopeId}`}
          className="text-sm font-normal cursor-pointer"
        >
          Make searchable
        </Label>
      </div>
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
