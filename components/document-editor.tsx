'use client';

import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  forwardRef,
  useImperativeHandle,
} from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import TiptapStarterKit from '@tiptap/starter-kit';
import { Markdown } from 'tiptap-markdown';
import { toast } from 'sonner';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardHeader } from './ui/card';
import { debounce } from '@/lib/utils/debounce';
import { useSWRConfig } from 'swr';
import { createDocumentCacheMutator } from '@/lib/cache/document-cache';

interface DocumentEditorProps {
  documentId: string;
  workspaceId: string;
  initialContent: string;
  initialTitle: string;
}

export interface DocumentEditorRef {
  saveNow: () => Promise<void>;
}

export const DocumentEditor = forwardRef<
  DocumentEditorRef,
  DocumentEditorProps
>(function DocumentEditor(
  { documentId, workspaceId, initialContent, initialTitle },
  ref,
) {
  const [title, setTitle] = useState(initialTitle);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const { mutate } = useSWRConfig();

  // Centralized cache mutator
  const cacheMutator = useMemo(
    () => createDocumentCacheMutator(mutate, workspaceId, documentId),
    [mutate, workspaceId, documentId],
  );

  const editor = useEditor({
    extensions: [
      TiptapStarterKit,
      Markdown.configure({
        html: true,
        tightLists: true,
        transformPastedText: true,
        transformCopiedText: true,
      }),
    ],
    content: initialContent,
    editable: true,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          'prose dark:prose-invert max-w-none focus:outline-none p-6 min-h-[400px]',
      },
    },
  });

  // Auto-save function
  const saveDocument = useCallback(
    async (content: string, titleToSave: string) => {
      if (!content) return; // Don't save empty content

      setIsSaving(true);

      try {
        const response = await fetch(
          `/api/workspace/${workspaceId}/document/${documentId}/content`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content, title: titleToSave }),
          },
        );

        if (!response.ok) {
          throw new Error('Failed to save');
        }

        setLastSaved(new Date());
        toast.success('Document saved', { duration: 1000 });

        // Invalidate all document-related caches (both SWR and Next.js)
        await cacheMutator.invalidateAll();
      } catch (error) {
        toast.error('Failed to save document');
      } finally {
        setIsSaving(false);
      }
    },
    [documentId, workspaceId, cacheMutator],
  );

  // Debounced auto-save (2 second delay)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const debouncedSave = useCallback(
    debounce((content: string, titleToSave: string) => {
      saveDocument(content, titleToSave);
    }, 2000),
    [saveDocument],
  );

  // Expose saveNow method via ref
  useImperativeHandle(ref, () => ({
    saveNow: async () => {
      if (!editor) return;
      const markdown =
        // biome-ignore lint/suspicious/noExplicitAny: Tiptap storage types don't include markdown extension
        (editor.storage as any).markdown?.getMarkdown?.() || editor.getText();
      await saveDocument(markdown, title);
    },
  }));

  // Listen for content changes
  useEffect(() => {
    if (!editor) return;

    const handleUpdate = () => {
      // Get markdown content from editor
      const markdown =
        // biome-ignore lint/suspicious/noExplicitAny: Tiptap storage types don't include markdown extension
        (editor.storage as any).markdown?.getMarkdown?.() || editor.getText();
      debouncedSave(markdown, title);
    };

    editor.on('update', handleUpdate);

    return () => {
      editor.off('update', handleUpdate);
    };
  }, [editor, title, debouncedSave]);

  // Listen for title changes
  useEffect(() => {
    if (!editor) return;
    // Get markdown content from editor
    const markdown =
      // biome-ignore lint/suspicious/noExplicitAny: Tiptap storage types don't include markdown extension
      (editor.storage as any).markdown?.getMarkdown?.() || editor.getText();
    debouncedSave(markdown, title);
  }, [title, editor, debouncedSave]);

  if (!editor) {
    return <div className="p-6 text-muted-foreground">Loading editor...</div>;
  }

  const characterCount =
    // biome-ignore lint/suspicious/noExplicitAny: Tiptap storage types don't include markdown extension
    ((editor.storage as any).markdown?.getMarkdown?.() || editor.getText())
      .length;

  return (
    <Card>
      <CardHeader>
        <div className="space-y-2">
          <Label htmlFor="title">Document Title</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter document title..."
            className="text-lg font-semibold"
          />
        </div>
      </CardHeader>
      <CardContent>
        <div className="border rounded-lg bg-background">
          <EditorContent editor={editor} />
        </div>

        <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
          <div>
            {isSaving ? (
              <span>Saving...</span>
            ) : lastSaved ? (
              <span>Last saved: {lastSaved.toLocaleTimeString()}</span>
            ) : (
              <span>No changes yet</span>
            )}
          </div>
          <div>{characterCount} characters</div>
        </div>
      </CardContent>
    </Card>
  );
});
