'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import TiptapStarterKit from '@tiptap/starter-kit';
import { Markdown } from 'tiptap-markdown';
import Placeholder from '@tiptap/extension-placeholder';
import { useLocalStorage } from 'usehooks-ts';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { updateObjectiveContextAction } from '@/lib/objective/objective-context';
import { debounce } from '@/lib/utils/debounce';

interface ObjectiveContextTabProps {
  objectiveId: string;
  initialContext: string | null;
  lastUpdated: Date | null;
  placeholder: string;
  customLabels?: {
    header?: string | null;
    description?: string | null;
  };
}

export function ObjectiveContextTab({
  objectiveId,
  initialContext,
  lastUpdated: initialLastUpdated,
  placeholder,
  customLabels,
}: ObjectiveContextTabProps) {
  // State for save status
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(initialLastUpdated);

  // LocalStorage backup
  const [localStorageBackup, setLocalStorageBackup] = useLocalStorage(
    `objective-context-${objectiveId}`,
    '',
  );

  // Save function
  const saveContext = useCallback(
    async (content: string) => {
      setIsSaving(true);

      const result = await updateObjectiveContextAction(objectiveId, content);

      if (result.error) {
        toast.error(result.error);
        setIsSaving(false);
        return;
      }

      // Success - clear localStorage backup
      setLocalStorageBackup('');
      setLastSaved(new Date());
      setIsSaving(false);
      toast.success('Context saved');
    },
    [objectiveId, setLocalStorageBackup],
  );

  // Debounced save (2 seconds - same as DocumentEditor)
  const debouncedSave = useMemo(
    () => debounce((content: string) => saveContext(content), 2000),
    [saveContext],
  );

  // Initialize editor
  const editor = useEditor({
    extensions: [
      TiptapStarterKit,
      Markdown.configure({
        html: true,
        tightLists: true,
        transformPastedText: true,
        transformCopiedText: true,
      }),
      Placeholder.configure({
        placeholder,
      }),
    ],
    content: initialContext || '',
    immediatelyRender: false, // Critical for Next.js SSR
    editorProps: {
      attributes: {
        class:
          'prose dark:prose-invert max-w-none focus:outline-none p-6 min-h-[400px]',
      },
      handlePaste: (view, event) => {
        // Get pasted content
        const text = event.clipboardData?.getData('text/plain');
        if (!text) return false;

        // Get current content
        const currentMarkdown =
          // biome-ignore lint/suspicious/noExplicitAny: Tiptap storage access
          (editor?.storage as any).markdown?.getMarkdown?.() ||
          editor?.getText() ||
          '';

        // Calculate what the new length would be
        const selection = view.state.selection;
        const textBefore = currentMarkdown.slice(0, selection.from);
        const textAfter = currentMarkdown.slice(selection.to);
        const potentialNewContent = textBefore + text + textAfter;

        // Check if paste would exceed limit
        const maxLength = 5000;
        if (potentialNewContent.length > maxLength) {
          // Truncate the pasted text to fit
          const availableSpace =
            maxLength - (textBefore.length + textAfter.length);
          if (availableSpace <= 0) {
            toast.error('Cannot paste: character limit reached');
            return true; // Prevent paste
          }

          const truncatedText = text.slice(0, availableSpace);
          toast.warning(
            `Pasted text truncated to fit ${maxLength} character limit`,
          );

          // Insert truncated text manually
          const { state, dispatch } = view;
          const tr = state.tr.insertText(
            truncatedText,
            selection.from,
            selection.to,
          );
          dispatch(tr);
          return true; // Prevent default paste
        }

        return false; // Allow default paste
      },
    },
  });

  // Handle editor updates
  useEffect(() => {
    if (!editor) return undefined;

    const handleUpdate = () => {
      const markdown =
        // biome-ignore lint/suspicious/noExplicitAny: Tiptap storage access
        (editor.storage as any).markdown?.getMarkdown?.() || editor.getText();

      // Check character limit
      if (markdown.length > 5000) {
        // Truncate to 5000 characters
        const truncated = markdown.slice(0, 5000);
        editor.commands.setContent(truncated);
        toast.error(
          'Character limit reached. Content truncated to 5,000 characters.',
        );
        return;
      }

      // Save to localStorage immediately (no debounce)
      setLocalStorageBackup(markdown);

      // Debounced server save
      debouncedSave(markdown);
    };

    editor.on('update', handleUpdate);
    return () => {
      editor.off('update', handleUpdate);
    };
  }, [editor, debouncedSave, setLocalStorageBackup]);

  // Character count
  const characterCount = editor
    ? // biome-ignore lint/suspicious/noExplicitAny: Tiptap storage access
      ((editor.storage as any).markdown?.getMarkdown?.() || editor.getText())
        .length
    : 0;

  // Character limit thresholds
  const isWarning = characterCount > 4750;
  const isAtLimit = characterCount >= 5000;

  if (!editor) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{customLabels?.header || 'Objective Context'}</CardTitle>
        <p className="text-sm text-muted-foreground">
          {customLabels?.description ||
            'Details about this specific goal, deal, or project'}
        </p>
      </CardHeader>
      <CardContent>
        <div className="border rounded-lg bg-background">
          <EditorContent editor={editor} />
        </div>
        <div className="mt-2 flex justify-between text-xs text-muted-foreground">
          <div>
            {isSaving ? (
              <span>Saving...</span>
            ) : lastSaved ? (
              <span>Last saved: {lastSaved.toLocaleTimeString()}</span>
            ) : (
              <span>No changes yet</span>
            )}
          </div>
          <div
            className={
              isAtLimit
                ? 'text-red-500 font-bold'
                : isWarning
                  ? 'text-amber-500 font-medium'
                  : ''
            }
          >
            {characterCount.toLocaleString()} / 5,000 characters
          </div>
        </div>
        {isAtLimit && (
          <p className="mt-2 text-xs text-red-500">
            Character limit reached. Please remove text before adding more.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
