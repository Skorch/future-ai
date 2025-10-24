'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  useEditor,
  EditorContent,
  type Editor,
  type AnyExtension,
} from '@tiptap/react';
import TiptapStarterKit from '@tiptap/starter-kit';
import { Markdown } from 'tiptap-markdown';
import Placeholder from '@tiptap/extension-placeholder';
import { Link } from '@tiptap/extension-link';
import { TaskList } from '@tiptap/extension-task-list';
import { TaskItem } from '@tiptap/extension-task-item';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableHeader } from '@tiptap/extension-table-header';
import { TableCell } from '@tiptap/extension-table-cell';
import { useLocalStorage } from 'usehooks-ts';
import { toast } from 'sonner';
import { debounce } from '@/lib/utils/debounce';
import { getLogger } from '@/lib/logger';
import { cn } from '@/lib/utils';
import { ContextMenu } from '@/components/markdown-editor/toolbar/context-menu';
import { InlineToolbar } from '@/components/markdown-editor/toolbar/inline-toolbar';

const logger = getLogger('MarkdownEditor');

/**
 * Feature flags for controlling which extensions are enabled
 */
export type MarkdownEditorFeature =
  | 'all'
  | 'tables'
  | 'tasks'
  | 'links'
  | 'bold'
  | 'italic'
  | 'code'
  | 'headings'
  | 'lists';

/**
 * Toolbar display mode
 */
export type ToolbarMode = 'floating' | 'inline' | 'both' | 'none';

/**
 * Save status indicator
 */
export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

/**
 * Props for MarkdownEditor component
 */
export interface MarkdownEditorProps {
  /** Current markdown content */
  value: string;

  /** Called when content changes */
  onChange?: (content: string) => void;

  /** Called when save is triggered (auto-save or manual) */
  onSave?: (content: string) => Promise<void>;

  /** Placeholder text when editor is empty */
  placeholder?: string;

  /** Maximum character length */
  maxLength?: number;

  /** Show the formatting toolbar */
  showToolbar?: boolean;

  /** Toolbar display mode (defaults to 'both') */
  toolbarMode?: ToolbarMode;

  /** Enable auto-save functionality */
  autoSave?: boolean;

  /** Auto-save debounce delay in milliseconds */
  saveDebounce?: number;

  /** Show character count indicator */
  showCharacterCount?: boolean;

  /** Enabled features (defaults to 'all') */
  features?: MarkdownEditorFeature[];

  /** Additional CSS classes for the editor container */
  className?: string;

  /** Make the editor read-only */
  readOnly?: boolean;

  /** Unique storage key for localStorage backup (optional) */
  storageKey?: string;

  /** ARIA label for accessibility */
  ariaLabel?: string;
}

/**
 * Get extensions based on enabled features
 */
function getExtensions(
  features: MarkdownEditorFeature[],
  placeholder: string,
): AnyExtension[] {
  const enableAll = features.includes('all');
  const extensions: AnyExtension[] = [
    TiptapStarterKit.configure({
      // Disable features that might conflict or we want to control separately
      heading: enableAll || features.includes('headings') ? undefined : false,
      bold: enableAll || features.includes('bold') ? undefined : false,
      italic: enableAll || features.includes('italic') ? undefined : false,
      code: enableAll || features.includes('code') ? undefined : false,
      bulletList: enableAll || features.includes('lists') ? undefined : false,
      orderedList: enableAll || features.includes('lists') ? undefined : false,
    }),
    Markdown.configure({
      html: true,
      tightLists: true,
      transformPastedText: true,
      transformCopiedText: true,
    }),
    Placeholder.configure({
      placeholder,
    }),
  ];

  // Add optional extensions based on features
  if (enableAll || features.includes('links')) {
    extensions.push(
      Link.configure({
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
      }),
    );
  }

  if (enableAll || features.includes('tasks')) {
    extensions.push(
      TaskList.configure({
        HTMLAttributes: {
          class: 'task-list',
        },
      }),
      TaskItem.configure({
        nested: true,
        HTMLAttributes: {
          class: 'task-item',
        },
      }),
    );
  }

  if (enableAll || features.includes('tables')) {
    extensions.push(
      Table.configure({
        resizable: true,
        HTMLAttributes: {
          class: 'markdown-table',
        },
      }),
      TableRow,
      TableHeader,
      TableCell,
    );
  }

  return extensions;
}

/**
 * MarkdownEditor - A flexible TipTap-based markdown editor
 *
 * Features:
 * - Full markdown support with TipTap
 * - Configurable extensions (tables, task lists, links)
 * - Auto-save with debouncing
 * - LocalStorage backup for unsaved changes
 * - Character counting and limits
 * - Paste truncation when exceeding limits
 * - Floating toolbar on text selection + inline toolbar at top (default)
 * - Read-only mode
 *
 * @example
 * ```tsx
 * <MarkdownEditor
 *   value={content}
 *   onChange={setContent}
 *   onSave={async (content) => await saveToServer(content)}
 *   placeholder="Start writing..."
 *   maxLength={10000}
 *   storageKey="my-editor-backup"
 *   toolbarMode="both" // Default: both inline and floating toolbars
 * />
 * ```
 */
export function MarkdownEditor({
  value,
  onChange,
  onSave,
  placeholder = '',
  maxLength = 50000,
  showToolbar = true,
  toolbarMode = 'both',
  autoSave = true,
  saveDebounce: saveDebounceProp = 2000,
  showCharacterCount = true,
  features = ['all'],
  className,
  readOnly = false,
  storageKey,
  ariaLabel = 'Markdown editor',
}: MarkdownEditorProps) {
  // State
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  // LocalStorage backup (only if storageKey provided)
  const [localStorageBackup, setLocalStorageBackup] = useLocalStorage(
    storageKey || '__markdown_editor_backup__',
    '',
  );

  /**
   * Save function - calls onSave prop and handles errors
   */
  const save = useCallback(
    async (content: string) => {
      if (!onSave || !autoSave) return;

      setSaveStatus('saving');

      try {
        await onSave(content);

        // Success - clear localStorage backup
        if (storageKey) {
          setLocalStorageBackup('');
        }

        setLastSaved(new Date());
        setSaveStatus('saved');
        toast.success('Saved');

        // Reset to idle after showing "saved" status
        setTimeout(() => setSaveStatus('idle'), 2000);
      } catch (error) {
        logger.error('Failed to save content', error);
        setSaveStatus('error');
        toast.error(
          error instanceof Error ? error.message : 'Failed to save content',
        );
      }
    },
    [onSave, autoSave, storageKey, setLocalStorageBackup],
  );

  /**
   * Debounced save (configurable delay)
   */
  const debouncedSave = useMemo(
    () => debounce((content: string) => save(content), saveDebounceProp),
    [save, saveDebounceProp],
  );

  /**
   * Initialize TipTap editor
   */
  const editor = useEditor({
    extensions: getExtensions(features, placeholder),
    content: value,
    editable: !readOnly,
    immediatelyRender: false, // Critical for Next.js SSR
    editorProps: {
      attributes: {
        class: cn(
          'prose dark:prose-invert max-w-none focus:outline-none',
          'min-h-[200px] p-4',
          readOnly && 'cursor-default',
        ),
        'aria-label': ariaLabel,
      },
      handlePaste: (view, event) => {
        if (readOnly) return false;

        // Get pasted content
        const text = event.clipboardData?.getData('text/plain');
        if (!text) return false;

        // Get current content as markdown
        const currentMarkdown =
          // biome-ignore lint/suspicious/noExplicitAny: TipTap storage access
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

  /**
   * Handle editor updates
   */
  useEffect(() => {
    if (!editor) return undefined;

    const handleUpdate = () => {
      const markdown =
        // biome-ignore lint/suspicious/noExplicitAny: TipTap storage access
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

      // Call onChange callback
      onChange?.(markdown);

      // Save to localStorage immediately (no debounce) if storageKey provided
      if (storageKey) {
        setLocalStorageBackup(markdown);
      }

      // Debounced server save
      if (autoSave && onSave) {
        debouncedSave(markdown);
      }
    };

    editor.on('update', handleUpdate);
    return () => {
      editor.off('update', handleUpdate);
    };
  }, [
    editor,
    onChange,
    debouncedSave,
    setLocalStorageBackup,
    maxLength,
    autoSave,
    onSave,
    storageKey,
  ]);

  /**
   * Update editor content when value prop changes externally
   */
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;

    const currentContent =
      // biome-ignore lint/suspicious/noExplicitAny: TipTap storage access
      (editor.storage as any).markdown?.getMarkdown?.() || editor.getText();

    // Only update if value is different and not from user typing
    if (value !== currentContent && !editor.isFocused) {
      editor.commands.setContent(value);
    }
  }, [value, editor]);

  // Calculate character count
  const characterCount = editor
    ? // biome-ignore lint/suspicious/noExplicitAny: TipTap storage access
      ((editor.storage as any).markdown?.getMarkdown?.() || editor.getText())
        .length
    : 0;

  const warningThreshold = Math.floor(maxLength * 0.95);
  const isWarning = characterCount > warningThreshold;
  const isAtLimit = characterCount >= maxLength;

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {/* Editor with optional inline toolbar */}
      <div className="border border-border rounded-md bg-background">
        {showToolbar &&
          (toolbarMode === 'inline' || toolbarMode === 'both') && (
            <InlineToolbar editor={editor} />
          )}
        <EditorContent editor={editor} />
      </div>

      {/* Context menu (appears on text selection OR when cursor is in a table) */}
      {showToolbar &&
        (toolbarMode === 'floating' || toolbarMode === 'both') && (
          <ContextMenu editor={editor} />
        )}

      {/* Footer: Character count and save status */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        {showCharacterCount && (
          <div
            className={cn(
              isAtLimit && 'text-destructive font-semibold',
              isWarning && !isAtLimit && 'text-warning font-medium',
            )}
          >
            {characterCount.toLocaleString()} / {maxLength.toLocaleString()}{' '}
            characters
          </div>
        )}

        {autoSave && onSave && (
          <div className="flex items-center gap-2">
            {saveStatus === 'saving' && <span>Saving...</span>}
            {saveStatus === 'saved' && (
              <span className="text-green-600 dark:text-green-400">
                Saved {lastSaved && `at ${lastSaved.toLocaleTimeString()}`}
              </span>
            )}
            {saveStatus === 'error' && (
              <span className="text-destructive">Failed to save</span>
            )}
          </div>
        )}
      </div>

      {/* LocalStorage backup indicator */}
      {storageKey && localStorageBackup && (
        <div className="text-xs text-amber-600 dark:text-amber-400">
          Unsaved changes backed up locally
        </div>
      )}
    </div>
  );
}

/**
 * Export editor instance type for external use
 */
export type { Editor };
