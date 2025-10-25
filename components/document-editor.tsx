'use client';

import {
  useState,
  useCallback,
  useMemo,
  forwardRef,
  useImperativeHandle,
  useRef,
} from 'react';
import { useSWRConfig } from 'swr';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardHeader } from './ui/card';
import { MarkdownEditor } from '@/components/markdown/markdown-editor';
import { createDocumentCacheMutator } from '@/lib/cache/document-cache';
import { createKnowledgeCacheMutator } from '@/lib/cache/knowledge-cache';
import { debounce } from '@/lib/utils/debounce';

interface DocumentEditorProps {
  documentId: string;
  workspaceId: string;
  initialContent: string;
  initialTitle: string;
  documentType: 'knowledge' | 'objective';
}

export interface DocumentEditorRef {
  saveNow: () => Promise<void>;
}

export const DocumentEditor = forwardRef<
  DocumentEditorRef,
  DocumentEditorProps
>(function DocumentEditor(
  { documentId, workspaceId, initialContent, initialTitle, documentType },
  ref,
) {
  const [title, setTitle] = useState(initialTitle);
  const [content, setContent] = useState(initialContent);
  const { mutate } = useSWRConfig();

  // Track last saved content to avoid duplicate saves
  const lastSavedRef = useRef({ content: initialContent, title: initialTitle });

  // Centralized cache mutator - conditional based on document type
  const cacheMutator = useMemo(() => {
    return documentType === 'knowledge'
      ? createKnowledgeCacheMutator(mutate, workspaceId, documentId)
      : createDocumentCacheMutator(mutate, workspaceId, documentId);
  }, [mutate, workspaceId, documentId, documentType]);

  // Auto-save function - handles both knowledge and objective documents
  const saveDocument = useCallback(
    async (contentToSave: string, titleToSave: string) => {
      if (!contentToSave) return; // Don't save empty content

      // Avoid duplicate saves
      if (
        lastSavedRef.current.content === contentToSave &&
        lastSavedRef.current.title === titleToSave
      ) {
        return;
      }

      try {
        if (documentType === 'knowledge') {
          // Knowledge documents: Single endpoint for both content and title
          const response = await fetch(
            `/api/workspace/${workspaceId}/knowledge/${documentId}`,
            {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                content: contentToSave,
                title: titleToSave,
              }),
            },
          );

          if (!response.ok) {
            throw new Error('Failed to save');
          }
        } else {
          // Objective documents: Content-only endpoint (title updates not supported in editing)
          const response = await fetch(
            `/api/workspace/${workspaceId}/document/${documentId}/content`,
            {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ content: contentToSave }),
            },
          );

          if (!response.ok) {
            throw new Error('Failed to save');
          }
        }

        // Update last saved reference
        lastSavedRef.current = { content: contentToSave, title: titleToSave };

        // Invalidate all document-related caches (both SWR and Next.js)
        await cacheMutator.invalidateAll();
      } catch (error) {
        // Re-throw to let MarkdownEditor handle the error display
        throw new Error('Failed to save document');
      }
    },
    [documentId, workspaceId, documentType, cacheMutator],
  );

  // Debounced title save - triggers when title changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const debouncedTitleSave = useCallback(
    debounce((titleToSave: string, contentToSave: string) => {
      void saveDocument(contentToSave, titleToSave);
    }, 2000),
    [saveDocument],
  );

  // Combined save handler that includes title
  const handleSave = useCallback(
    async (contentToSave: string) => {
      await saveDocument(contentToSave, title);
    },
    [saveDocument, title],
  );

  // Handle title changes with debounced save
  const handleTitleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newTitle = e.target.value;
      setTitle(newTitle);

      // Trigger debounced save with current content
      debouncedTitleSave(newTitle, content);
    },
    [debouncedTitleSave, content],
  );

  // Expose saveNow method via ref
  useImperativeHandle(ref, () => ({
    saveNow: async () => {
      await saveDocument(content, title);
    },
  }));

  return (
    <Card>
      <CardHeader>
        <div className="space-y-2">
          <Label htmlFor="title">Document Title</Label>
          <Input
            id="title"
            value={title}
            onChange={handleTitleChange}
            placeholder="Enter document title..."
            className="text-lg font-semibold"
          />
        </div>
      </CardHeader>
      <CardContent>
        <MarkdownEditor
          value={content}
          onChange={setContent}
          onSave={handleSave}
          placeholder="Start writing your document..."
          maxLength={50000}
          showToolbar
          autoSave
          saveDebounce={2000}
          showCharacterCount
          className="mt-4"
          ariaLabel="Document content editor"
        />
      </CardContent>
    </Card>
  );
});
