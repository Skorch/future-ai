'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';
import { useEditor, type Editor } from '@tiptap/react';
import TiptapStarterKit from '@tiptap/starter-kit';
import { Markdown } from 'tiptap-markdown';
import Placeholder from '@tiptap/extension-placeholder';
import { useLocalStorage } from 'usehooks-ts';
import { toast } from 'sonner';
import { debounce } from '@/lib/utils/debounce';
import {
  OBJECTIVE_FIELD_MAX_LENGTH,
  OBJECTIVE_FIELD_WARNING_THRESHOLD,
} from '@/lib/objective/constants';

/**
 * Props for MarkdownEditorProvider
 */
export interface MarkdownEditorProviderProps {
  children: ReactNode;
  id: string; // objectiveId or workspaceId
  initialContent: string | null;
  initialLastSaved: Date | null;
  storageKey: string; // e.g., "objective-goal-{id}"
  saveAction: (
    id: string,
    content: string,
  ) => Promise<undefined | { error: string }>;
  placeholder?: string;
  maxLength?: number; // Default: OBJECTIVE_FIELD_MAX_LENGTH
  warningThreshold?: number; // Default: OBJECTIVE_FIELD_WARNING_THRESHOLD (0.95)
  onSaveSuccess?: () => void;
  onSaveError?: (error: Error) => void;
  ariaLabel?: string; // Accessibility label for editor
}

/**
 * Context value provided by MarkdownEditorProvider
 */
export interface MarkdownEditorContext {
  editor: Editor | null;
  content: string;
  isSaving: boolean;
  lastSaved: Date | null;
  characterCount: number;
  maxLength: number;
  warningThreshold: number;
  isWarning: boolean;
  isAtLimit: boolean;
}

const MarkdownEditorContext = createContext<MarkdownEditorContext | null>(null);

/**
 * MarkdownEditorProvider - Consolidates shared Tiptap editor logic
 *
 * Handles:
 * - Tiptap editor setup with Markdown, StarterKit, Placeholder extensions
 * - LocalStorage backup (instant)
 * - Debounced save to server (2 seconds)
 * - Character counting and limit enforcement
 * - Paste truncation when exceeding limits
 * - Toast notifications for save success/error
 */
export function MarkdownEditorProvider({
  children,
  id,
  initialContent,
  initialLastSaved,
  storageKey,
  saveAction,
  placeholder = '',
  maxLength = OBJECTIVE_FIELD_MAX_LENGTH,
  warningThreshold = OBJECTIVE_FIELD_WARNING_THRESHOLD,
  onSaveSuccess,
  onSaveError,
  ariaLabel = 'Markdown editor',
}: MarkdownEditorProviderProps) {
  // State for save status
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(initialLastSaved);

  // LocalStorage backup
  const [localStorageBackup, setLocalStorageBackup] = useLocalStorage(
    storageKey,
    '',
  );

  // Save function
  const save = useCallback(
    async (content: string) => {
      setIsSaving(true);

      try {
        const result = await saveAction(id, content);

        // Check if result has error property (error-returning saveAction)
        if (result && typeof result === 'object' && 'error' in result) {
          toast.error(result.error);
          onSaveError?.(new Error(result.error));
          return;
        }

        // Success - clear localStorage backup
        setLocalStorageBackup('');
        setLastSaved(new Date());
        toast.success('Saved');
        onSaveSuccess?.();
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Failed to save';
        toast.error(errorMessage);
        onSaveError?.(
          error instanceof Error ? error : new Error('Failed to save'),
        );
      } finally {
        setIsSaving(false);
      }
    },
    [id, saveAction, setLocalStorageBackup, onSaveSuccess, onSaveError],
  );

  // Debounced save (2 seconds - same as DocumentEditor)
  const debouncedSave = useMemo(
    () => debounce((content: string) => save(content), 2000),
    [save],
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
    content: initialContent || '',
    immediatelyRender: false, // Critical for Next.js SSR
    editorProps: {
      attributes: {
        class:
          'prose dark:prose-invert max-w-none focus:outline-none p-6 min-h-[400px]',
        'aria-label': ariaLabel,
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
            `Pasted text truncated to fit ${maxLength.toLocaleString()} character limit`,
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
      if (markdown.length > maxLength) {
        // Truncate to max length
        const truncated = markdown.slice(0, maxLength);
        editor.commands.setContent(truncated);
        toast.error(
          `Character limit reached. Content truncated to ${maxLength.toLocaleString()} characters.`,
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
  }, [editor, debouncedSave, setLocalStorageBackup, maxLength]);

  // Character count
  const characterCount = editor
    ? // biome-ignore lint/suspicious/noExplicitAny: Tiptap storage access
      ((editor.storage as any).markdown?.getMarkdown?.() || editor.getText())
        .length
    : 0;

  // Content for consumers
  const content = editor
    ? // biome-ignore lint/suspicious/noExplicitAny: Tiptap storage access
      (editor.storage as any).markdown?.getMarkdown?.() || editor.getText()
    : '';

  // Character limit thresholds
  const warningThresholdCount = Math.floor(maxLength * warningThreshold);
  const isWarning = characterCount > warningThresholdCount;
  const isAtLimit = characterCount >= maxLength;

  const contextValue: MarkdownEditorContext = {
    editor,
    content,
    isSaving,
    lastSaved,
    characterCount,
    maxLength,
    warningThreshold: warningThresholdCount,
    isWarning,
    isAtLimit,
  };

  return (
    <MarkdownEditorContext.Provider value={contextValue}>
      {children}
    </MarkdownEditorContext.Provider>
  );
}

/**
 * Hook to access MarkdownEditor context
 *
 * @throws Error if used outside of MarkdownEditorProvider
 */
export function useMarkdownEditor() {
  const context = useContext(MarkdownEditorContext);
  if (!context) {
    throw new Error(
      'useMarkdownEditor must be used within MarkdownEditorProvider',
    );
  }
  return context;
}
