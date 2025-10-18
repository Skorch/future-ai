'use client';

import { useState, useEffect, useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import TiptapStarterKit from '@tiptap/starter-kit';
import { Markdown } from 'tiptap-markdown';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { ChevronDown, ChevronRight, Lock, Pencil } from 'lucide-react';
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

export function PromptLayerEditor({
  label,
  dbField,
  content,
  editable,
  expanded,
  onToggle,
  onSave,
}: PromptLayerEditorProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

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
}
