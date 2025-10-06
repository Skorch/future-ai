'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import { Label } from './ui/label';
import { UploadIcon, XIcon } from 'lucide-react';
import {
  publishDocumentAction,
  unpublishDocumentAction,
} from '@/lib/workspace/document-actions';

interface FloatingPublishButtonProps {
  documentEnvelopeId: string;
  versionId: string;
  isPublished: boolean;
  isSearchable: boolean;
  workspaceId: string;
}

export function FloatingPublishButton({
  documentEnvelopeId,
  versionId,
  isPublished,
  isSearchable,
  workspaceId,
}: FloatingPublishButtonProps) {
  const [processing, setProcessing] = useState(false);
  const [makeSearchable, setMakeSearchable] = useState(isSearchable ?? true);

  const handlePublish = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent click from bubbling
    setProcessing(true);
    try {
      await publishDocumentAction(
        documentEnvelopeId,
        versionId,
        makeSearchable,
        workspaceId,
      );
      toast.success('Document published successfully');
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to publish document',
      );
    } finally {
      setProcessing(false);
    }
  };

  const handleUnpublish = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent click from bubbling
    setProcessing(true);
    try {
      await unpublishDocumentAction(documentEnvelopeId, workspaceId);
      toast.success('Document unpublished');
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to unpublish document',
      );
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      className="fixed bottom-6 right-6 flex items-center gap-3 bg-background rounded-full shadow-lg border px-4 py-2 z-50"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.stopPropagation();
        }
      }}
    >
      {!isPublished && (
        <div className="flex items-center gap-2">
          <Checkbox
            id={`floating-searchable-${documentEnvelopeId}`}
            checked={makeSearchable}
            onCheckedChange={(checked) => setMakeSearchable(checked === true)}
            disabled={processing}
          />
          <Label
            htmlFor={`floating-searchable-${documentEnvelopeId}`}
            className="text-sm font-normal cursor-pointer"
          >
            Searchable
          </Label>
        </div>
      )}
      <Button
        onClick={isPublished ? handleUnpublish : handlePublish}
        disabled={processing}
        variant={isPublished ? 'outline' : 'default'}
        className="rounded-full gap-2"
        size="sm"
      >
        {processing ? (
          '...'
        ) : isPublished ? (
          <>
            <XIcon className="w-3.5 h-3.5" />
            Unpublish
          </>
        ) : (
          <>
            <UploadIcon className="w-3.5 h-3.5" />
            Publish
          </>
        )}
      </Button>
    </div>
  );
}
