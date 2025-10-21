'use client';

import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { FileAudioIcon } from 'lucide-react';
import { useKnowledge } from '../providers/knowledge-provider';

// Re-export the hook for convenience
export { useKnowledge } from '../providers/knowledge-provider';

/**
 * KnowledgeInput - Textarea primitive with byte counter
 *
 * Pure UI component that reads content from context and triggers setContent.
 * Can be used in any composition that needs text input.
 */
export function KnowledgeInput() {
  const {
    content,
    setContent,
    byteSize,
    maxSize,
    isSubmitting,
    isReadingFile,
  } = useKnowledge();

  const isOverLimit = byteSize > maxSize;

  return (
    <div className="grid gap-2">
      <Label htmlFor="content">Content</Label>
      <Textarea
        id="content"
        placeholder="Paste your content here or upload a file..."
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={12}
        disabled={isSubmitting || isReadingFile}
        autoFocus
        className="resize-none"
      />
      <p className="text-xs text-muted-foreground">
        {(byteSize / 1024).toFixed(1)} KB / {maxSize / 1024} KB
      </p>
      {isOverLimit && (
        <p className="text-sm text-destructive">
          Content exceeds {maxSize / 1024}KB limit. Please reduce the text
          length.
        </p>
      )}
    </div>
  );
}

/**
 * KnowledgeUploadButton - File upload trigger primitive
 *
 * Handles file input and triggers uploadFile action from context.
 * Can be styled differently for different compositions (modal vs sidebar).
 */
export function KnowledgeUploadButton() {
  const { uploadFile, isSubmitting, isReadingFile } = useKnowledge();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    await uploadFile(file);

    // Reset file input to allow re-uploading same file
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".txt,.md,.vtt,.srt,.transcript"
        onChange={handleFileSelect}
        className="hidden"
      />
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
    </>
  );
}

/**
 * AddButton - Just add document without summary
 *
 * Triggers createDocument(false) from context.
 */
export function AddButton() {
  const { createDocument, isValid, isSubmitting, submittingAction } =
    useKnowledge();

  return (
    <Button
      variant="outline"
      onClick={() => createDocument(false)}
      disabled={!isValid || isSubmitting}
    >
      {isSubmitting && submittingAction === 'add' ? 'Adding...' : 'Add'}
    </Button>
  );
}

/**
 * SummarizeButton - Add and create summary
 *
 * Triggers createDocument(true) from context, which will navigate to chat.
 */
export function SummarizeButton() {
  const { createDocument, isValid, isSubmitting, submittingAction } =
    useKnowledge();

  return (
    <Button
      onClick={() => createDocument(true)}
      disabled={!isValid || isSubmitting}
    >
      {isSubmitting && submittingAction === 'summarize'
        ? 'Creating Summary...'
        : 'Add and Create Summary'}
    </Button>
  );
}

/*
 * FUTURE PRIMITIVES:
 *
 * - KnowledgeBulkUpload - for selecting and uploading multiple files at once
 * - KnowledgeQuickAdd - compact button+input combo for sidebar
 * - KnowledgeAutoAnalyze - toggle to enable automatic AI categorization
 * - KnowledgeCategorySelect - dropdown to manually set category before upload
 * - KnowledgeProgressList - shows upload progress for multiple files
 */
