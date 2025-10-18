'use client';

import {
  useState,
  useEffect,
  useCallback,
  useRef,
  forwardRef,
  useImperativeHandle,
} from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import TiptapStarterKit from '@tiptap/starter-kit';
import { Markdown } from 'tiptap-markdown';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  ChevronDown,
  ChevronRight,
  Lock,
  Pencil,
  Bold,
  Italic,
  List,
  ListOrdered,
  Heading1,
  Heading2,
  Heading3,
} from 'lucide-react';
import { debounce } from '@/lib/utils/debounce';
import { countTokens } from '@/lib/utils/token-counter';

interface PromptLayerEditorProps {
  label: string;
  dbField?: string;
  content: string;
  editable: boolean;
  expanded: boolean;
  onToggle: () => void;
  onSave: (content: string) => Promise<void>;
}

export interface PromptLayerEditorRef {
  saveNow: () => Promise<void>;
}

export const PromptLayerEditor = forwardRef<
  PromptLayerEditorRef,
  PromptLayerEditorProps
>(function PromptLayerEditor(
  { label, dbField, content, editable, expanded, onToggle, onSave },
  ref,
) {
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isDirty, setIsDirty] = useState(false); // Track unsaved changes
  const [, setEditorState] = useState(0); // Force re-render on selection change
  const isLoadingContent = useRef(false); // Track programmatic content updates

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
    content,
    editable,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          'prose dark:prose-invert max-w-none focus:outline-none p-4 min-h-[200px]',
      },
    },
  });

  // Auto-save function
  const saveContent = useCallback(
    async (newContent: string) => {
      if (!editable || !newContent) return;

      setIsSaving(true);
      try {
        await onSave(newContent);
        setLastSaved(new Date());
        setIsDirty(false); // Clear dirty flag after successful save
        toast.success('Layer saved', { duration: 1000 });
      } catch (error) {
        toast.error('Failed to save layer');
      } finally {
        setIsSaving(false);
      }
    },
    [editable, onSave],
  );

  // Debounced auto-save (2 second delay)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const debouncedSave = useCallback(
    debounce((newContent: string) => {
      saveContent(newContent);
    }, 2000),
    [saveContent],
  );

  // Listen for content changes
  useEffect(() => {
    if (!editor || !editable) return;

    const handleUpdate = () => {
      // Ignore updates from programmatic content changes (e.g., domain switch)
      if (isLoadingContent.current) return;

      setIsDirty(true); // Mark as dirty on user edit only
      const markdown =
        // biome-ignore lint/suspicious/noExplicitAny: Tiptap storage types don't include markdown extension
        (editor.storage as any).markdown?.getMarkdown?.() || editor.getText();
      debouncedSave(markdown);
    };

    editor.on('update', handleUpdate);

    return () => {
      editor.off('update', handleUpdate);
    };
  }, [editor, editable, debouncedSave]);

  // Listen for selection changes to update toolbar button states
  useEffect(() => {
    if (!editor) return;

    const handleSelectionUpdate = () => {
      // Force re-render to update button active states
      setEditorState((prev) => prev + 1);
    };

    editor.on('selectionUpdate', handleSelectionUpdate);

    return () => {
      editor.off('selectionUpdate', handleSelectionUpdate);
    };
  }, [editor]);

  // Update editor content when prop changes (e.g., domain switch)
  useEffect(() => {
    if (!editor || !content) return;

    // Only update if content actually changed to avoid disrupting user edits
    const currentContent =
      // biome-ignore lint/suspicious/noExplicitAny: Tiptap storage types don't include markdown extension
      (editor.storage as any).markdown?.getMarkdown?.() || editor.getText();

    if (currentContent !== content) {
      // Flag that we're loading new content to ignore the 'update' event
      isLoadingContent.current = true;
      editor.commands.setContent(content);
      setIsDirty(false); // New content loaded, not dirty yet

      // Clear the flag after the update event has fired
      setTimeout(() => {
        isLoadingContent.current = false;
      }, 0);
    }
  }, [content, editor]);

  // Expose saveNow method via ref (like DocumentEditor pattern)
  useImperativeHandle(ref, () => ({
    saveNow: async () => {
      if (!editor || !editable || !isDirty) return; // Skip if not dirty
      const markdown =
        // biome-ignore lint/suspicious/noExplicitAny: Tiptap storage types don't include markdown extension
        (editor.storage as any).markdown?.getMarkdown?.() || editor.getText();
      await saveContent(markdown);
    },
  }));

  if (!editor) {
    return null;
  }

  const currentContent =
    // biome-ignore lint/suspicious/noExplicitAny: Tiptap storage types don't include markdown extension
    (editor.storage as any).markdown?.getMarkdown?.() || editor.getText();
  const tokenCount = countTokens(currentContent);

  return (
    <Card>
      <CardHeader
        className="cursor-pointer hover:bg-accent/50 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {expanded ? (
              <ChevronDown className="size-4" />
            ) : (
              <ChevronRight className="size-4" />
            )}
            <div>
              <h3 className="font-semibold">{label}</h3>
              {dbField && (
                <p className="text-xs text-muted-foreground mt-1">
                  {dbField}{' '}
                  {editable ? (
                    <Pencil className="inline size-3" />
                  ) : (
                    <Lock className="inline size-3" />
                  )}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs text-muted-foreground">
              {tokenCount.toLocaleString()} tokens
            </span>
          </div>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="space-y-2">
          {editable && (
            <div className="flex items-center gap-1 p-2 border rounded-lg bg-muted/50">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().toggleBold().run()}
                className={editor.isActive('bold') ? 'bg-accent' : ''}
              >
                <Bold className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().toggleItalic().run()}
                className={editor.isActive('italic') ? 'bg-accent' : ''}
              >
                <Italic className="size-4" />
              </Button>
              <div className="w-px h-6 bg-border mx-1" />
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  editor.chain().focus().toggleHeading({ level: 1 }).run()
                }
                className={
                  editor.isActive('heading', { level: 1 }) ? 'bg-accent' : ''
                }
              >
                <Heading1 className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  editor.chain().focus().toggleHeading({ level: 2 }).run()
                }
                className={
                  editor.isActive('heading', { level: 2 }) ? 'bg-accent' : ''
                }
              >
                <Heading2 className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  editor.chain().focus().toggleHeading({ level: 3 }).run()
                }
                className={
                  editor.isActive('heading', { level: 3 }) ? 'bg-accent' : ''
                }
              >
                <Heading3 className="size-4" />
              </Button>
              <div className="w-px h-6 bg-border mx-1" />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().toggleBulletList().run()}
                className={editor.isActive('bulletList') ? 'bg-accent' : ''}
              >
                <List className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().toggleOrderedList().run()}
                className={editor.isActive('orderedList') ? 'bg-accent' : ''}
              >
                <ListOrdered className="size-4" />
              </Button>
            </div>
          )}
          <div className="border rounded-lg bg-background">
            <EditorContent editor={editor} />
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div>
              {isSaving ? (
                <span>Saving...</span>
              ) : lastSaved ? (
                <span>Last saved: {lastSaved.toLocaleTimeString()}</span>
              ) : editable ? (
                <span>Ready to edit</span>
              ) : (
                <span>Read-only</span>
              )}
            </div>
            <div>{currentContent.length} characters</div>
          </div>
        </CardContent>
      )}
    </Card>
  );
});
