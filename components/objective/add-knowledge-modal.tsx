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
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { FileAudioIcon } from 'lucide-react';
import { logger } from '@/lib/logger';

interface AddKnowledgeModalProps {
  workspaceId: string;
  objectiveId: string;
  onSuccess?: (documentId: string) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const MAX_SIZE = 400 * 1024; // 400KB in bytes

export function AddKnowledgeModal({
  workspaceId,
  objectiveId,
  onSuccess,
  open,
  onOpenChange,
}: AddKnowledgeModalProps) {
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittingAction, setSubmittingAction] = useState<
    'add' | 'summarize' | null
  >(null);
  const [isReadingFile, setIsReadingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isSubmittingRef = useRef(false);
  const router = useRouter();

  // Calculate byte size using UTF-8 encoding
  const byteSize = useMemo(
    () => new TextEncoder().encode(content).length,
    [content],
  );

  const isValid = content.trim().length > 0 && byteSize <= MAX_SIZE;

  // Clear content when modal closes
  useEffect(() => {
    if (!open) {
      setContent('');
    }
  }, [open]);

  // File upload handler
  const handleFileSelect = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate extension
    const validExtensions = ['.txt', '.md', '.vtt', '.srt', '.transcript'];
    const fileExt = `.${file.name.split('.').pop()?.toLowerCase()}`;
    if (!validExtensions.includes(fileExt)) {
      toast.error(`Invalid file type. Allowed: ${validExtensions.join(', ')}`);
      return;
    }

    // Validate size (400KB)
    if (file.size > MAX_SIZE) {
      toast.error('File size must be less than 400KB');
      return;
    }

    // Read and populate textarea
    setIsReadingFile(true);
    try {
      const fileContent = await file.text();
      setContent(fileContent);
      toast.success(`Loaded ${file.name}`);
    } catch (error) {
      logger.error('File read error:', error);
      toast.error(
        error instanceof Error
          ? `Failed to read file: ${error.message}`
          : 'Failed to read file content',
      );
    } finally {
      setIsReadingFile(false);
      // Reset file input to allow re-uploading same file
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const createKnowledgeDocument = async (createSummary: boolean) => {
    if (!isValid || isSubmittingRef.current) return;

    isSubmittingRef.current = true;
    setIsSubmitting(true);
    setSubmittingAction(createSummary ? 'summarize' : 'add');

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

      // UX Polish: Contextual success message
      toast.success(
        createSummary
          ? 'Knowledge document created! Opening summary chat...'
          : 'Knowledge document created successfully!',
      );

      // Close dialog first
      onOpenChange(false);

      // Wait for dialog animation to complete (150ms)
      await new Promise((resolve) => setTimeout(resolve, 150));

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
      // Distinguish network errors from API errors
      if (error instanceof TypeError && error.message.includes('fetch')) {
        toast.error(
          'Network error. Please check your connection and try again.',
        );
      } else {
        toast.error(
          error instanceof Error
            ? error.message
            : 'Failed to create knowledge document',
        );
      }
      logger.error('Knowledge document creation error:', error);
    } finally {
      setIsSubmitting(false);
      setSubmittingAction(null);
      isSubmittingRef.current = false;
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
            Upload a file or paste content below. We&apos;ll automatically
            analyze and classify it.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.md,.vtt,.srt,.transcript"
            onChange={handleFileSelect}
            className="hidden"
          />

          {/* File upload button */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={isSubmitting || isReadingFile}
            className="w-full"
          >
            <FileAudioIcon className="mr-2 size-4" />
            {isReadingFile ? 'Reading file...' : 'Upload File'}
          </Button>

          <div className="grid gap-2">
            <Label htmlFor="content">Content</Label>
            <Textarea
              id="content"
              placeholder="Paste your content here or upload a file above..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={12}
              disabled={isSubmitting || isReadingFile}
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
            {isSubmitting && submittingAction === 'add' ? 'Adding...' : 'Add'}
          </Button>
          <Button
            onClick={handleAddAndSummarize}
            disabled={!isValid || isSubmitting}
          >
            {isSubmitting && submittingAction === 'summarize'
              ? 'Creating Summary...'
              : 'Add and Create Summary'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
