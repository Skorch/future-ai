import { EditorContent } from '@tiptap/react';
import { useMarkdownEditor } from '../providers';

/**
 * Renders the Tiptap EditorContent with border styling
 */
export function MarkdownEditorView() {
  const { editor } = useMarkdownEditor();

  if (!editor) return null;

  return (
    <div className="border rounded-lg bg-background">
      <EditorContent editor={editor} />
    </div>
  );
}

/**
 * Displays current save status (saving, last saved time, or no changes)
 */
export function SaveStatus() {
  const { isSaving, lastSaved } = useMarkdownEditor();

  return (
    <div className="text-xs text-muted-foreground">
      {isSaving ? (
        <span>Saving...</span>
      ) : lastSaved ? (
        <span>Last saved: {lastSaved.toLocaleTimeString()}</span>
      ) : (
        <span>No changes yet</span>
      )}
    </div>
  );
}

/**
 * Displays character count with warning/error styling based on limits
 */
export function CharacterCounter() {
  const { characterCount, maxLength, isWarning, isAtLimit } =
    useMarkdownEditor();

  return (
    <div
      className={
        isAtLimit
          ? 'text-xs text-red-500 font-bold'
          : isWarning
            ? 'text-xs text-amber-500 font-medium'
            : 'text-xs text-muted-foreground'
      }
    >
      {characterCount.toLocaleString()} / {maxLength.toLocaleString()}{' '}
      characters
    </div>
  );
}

/**
 * Displays error message when at character limit
 */
export function CharacterLimitWarning() {
  const { isAtLimit } = useMarkdownEditor();

  if (!isAtLimit) return null;

  return (
    <p className="mt-2 text-xs text-red-500">
      Character limit reached. Please remove text before adding more.
    </p>
  );
}
