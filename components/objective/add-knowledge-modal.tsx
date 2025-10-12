'use client';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

interface AddKnowledgeModalProps {
  workspaceId: string;
  objectiveId: string;
  onSuccess?: (documentId: string) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialContent?: string; // Pre-fill content (e.g., from uploaded file)
}

const MAX_SIZE = 400 * 1024; // 400KB in bytes

export function AddKnowledgeModal({
  workspaceId,
  objectiveId,
  onSuccess,
  open,
  onOpenChange,
  initialContent = '',
}: AddKnowledgeModalProps) {
  const [content, setContent] = useState(initialContent);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  // Calculate byte size using UTF-8 encoding
  const byteSize = useMemo(
    () => new TextEncoder().encode(content).length,
    [content],
  );

  const isValid = content.trim().length > 0 && byteSize <= MAX_SIZE;

  // Initialize content when modal opens with initialContent
  useEffect(() => {
    if (open && initialContent) {
      setContent(initialContent);
    } else if (!open) {
      setContent('');
    }
  }, [open, initialContent]);

  const createKnowledgeDocument = async (createSummary: boolean) => {
    if (!isValid) return;

    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/workspace/${workspaceId}/knowledge`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(createSummary && { 'X-Create-Summary': 'true' }),
        },
        body: JSON.stringify({
          content,
          category: 'raw',
          objectiveId,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create knowledge document');
      }

      const data = await response.json();

      toast.success('Knowledge document created successfully!');

      // Close dialog
      onOpenChange(false);

      // Notify parent component
      onSuccess?.(data.document.id);

      // Refresh the page to show new document
      router.refresh();

      // Navigate to chat if summary requested
      if (createSummary && data.shouldCreateSummary) {
        // Simple instruction for AI to load and summarize the document
        const summaryPrompt = `Please load and create a summary of the document I just created titled "${data.document.title}".`;

        const queryParam = encodeURIComponent(summaryPrompt);
        router.push(
          `/workspace/${workspaceId}/chat/new?objectiveId=${objectiveId}&query=${queryParam}&autoSubmit=true`,
        );
      }
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Failed to create knowledge document',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAdd = async () => {
    await createKnowledgeDocument(false);
  };

  const handleAddAndSummarize = async () => {
    await createKnowledgeDocument(true);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Add Knowledge to Objective</DialogTitle>
          <DialogDescription>
            Paste meeting notes, emails, transcripts, or any text. We&apos;ll
            automatically analyze and classify it.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="content">Content</Label>
            <Textarea
              id="content"
              placeholder="Paste your content here..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={12}
              disabled={isSubmitting}
              autoFocus
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              {(byteSize / 1024).toFixed(1)} KB / 400 KB
            </p>
            {byteSize > MAX_SIZE && (
              <p className="text-sm text-destructive">
                Content exceeds 400KB limit. Please reduce the text length.
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleAdd}
            disabled={!isValid || isSubmitting}
          >
            {isSubmitting ? 'Adding...' : 'Add'}
          </Button>
          <Button
            onClick={handleAddAndSummarize}
            disabled={!isValid || isSubmitting}
          >
            {isSubmitting ? 'Adding...' : 'Add and Create Summary'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
