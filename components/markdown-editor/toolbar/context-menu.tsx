'use client';

import { useState, useEffect } from 'react';
import type { Editor } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import {
  ToolbarButton,
  ToolbarSeparator,
  boldButton,
  italicButton,
  strikeButton,
  heading1Button,
  heading2Button,
  heading3Button,
  bulletListButton,
  orderedListButton,
  taskListButton,
  codeButton,
  blockquoteButton,
  linkButton,
  tableButton,
  clearFormattingButton,
} from './toolbar-buttons';
import {
  Plus,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Trash2,
  Combine,
  Split,
  Heading,
  Minus,
} from 'lucide-react';

interface ContextMenuProps {
  editor: Editor | null;
}

/**
 * TextFormattingControls - Text formatting buttons for selected text
 */
function TextFormattingControls({ editor }: { editor: Editor }) {
  const buttons = [
    // Text formatting
    boldButton,
    italicButton,
    strikeButton,
    // Headings (desktop only)
    heading1Button,
    heading2Button,
    heading3Button,
    // Lists
    bulletListButton,
    orderedListButton,
    taskListButton,
    // Code
    codeButton,
    blockquoteButton,
    // Insert
    linkButton,
    tableButton,
    // Actions
    clearFormattingButton,
  ];

  return (
    <>
      {/* Desktop: Show all buttons */}
      <div className="hidden md:flex gap-1">
        {buttons.map((button, index) => {
          // Add separator before each group: headings, lists, code, insert, actions
          const showSeparatorBefore =
            button.key === 'h1' ||
            button.key === 'bulletList' ||
            button.key === 'code' ||
            button.key === 'link' ||
            button.key === 'clearFormatting';

          return (
            <div key={button.key} className="flex items-center">
              {showSeparatorBefore && index > 0 && <ToolbarSeparator />}
              <ToolbarButton
                onClick={() => button.onClick(editor)}
                isActive={button.isActive(editor)}
                icon={button.icon}
                label={button.label}
              />
            </div>
          );
        })}
      </div>

      {/* Mobile: Show essential buttons only */}
      <div className="flex md:hidden gap-1">
        {buttons
          .filter(
            (button) =>
              button.key === 'bold' ||
              button.key === 'italic' ||
              button.key === 'h1' ||
              button.key === 'code',
          )
          .map((button) => (
            <ToolbarButton
              key={button.key}
              onClick={() => button.onClick(editor)}
              isActive={button.isActive(editor)}
              icon={button.icon}
              label={button.label}
            />
          ))}
      </div>
    </>
  );
}

/**
 * TableControls - Table operation buttons when cursor is in a table
 */
function TableControls({ editor }: { editor: Editor }) {
  /**
   * Check if merge cells is available
   * (requires multiple cells selected)
   */
  const canMergeCells = () => {
    // TipTap's mergeCells command only works if multiple cells are selected
    // We check if the command can run
    return editor.can().mergeCells();
  };

  /**
   * Check if split cell is available
   * (requires a merged cell)
   */
  const canSplitCell = () => {
    return editor.can().splitCell();
  };

  return (
    <>
      {/* Row operations */}
      <div className="flex items-center gap-1">
        <ToolbarButton
          onClick={() => editor.chain().focus().addRowBefore().run()}
          icon={
            <div className="flex items-center gap-0.5">
              <Plus className="size-3" />
              <ArrowUp className="size-3" />
            </div>
          }
          label="Add row before"
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().addRowAfter().run()}
          icon={
            <div className="flex items-center gap-0.5">
              <Plus className="size-3" />
              <ArrowDown className="size-3" />
            </div>
          }
          label="Add row after"
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().deleteRow().run()}
          icon={
            <div className="flex items-center gap-0.5">
              <Trash2 className="size-3" />
              <Minus className="size-3 rotate-0" />
            </div>
          }
          label="Delete row"
        />
      </div>

      <ToolbarSeparator />

      {/* Column operations */}
      <div className="flex items-center gap-1">
        <ToolbarButton
          onClick={() => editor.chain().focus().addColumnBefore().run()}
          icon={
            <div className="flex items-center gap-0.5">
              <Plus className="size-3" />
              <ArrowLeft className="size-3" />
            </div>
          }
          label="Add column before"
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().addColumnAfter().run()}
          icon={
            <div className="flex items-center gap-0.5">
              <Plus className="size-3" />
              <ArrowRight className="size-3" />
            </div>
          }
          label="Add column after"
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().deleteColumn().run()}
          icon={
            <div className="flex items-center gap-0.5">
              <Trash2 className="size-3" />
              <Minus className="size-3 rotate-90" />
            </div>
          }
          label="Delete column"
        />
      </div>

      <ToolbarSeparator />

      {/* Cell operations */}
      <div className="flex items-center gap-1">
        <ToolbarButton
          onClick={() => editor.chain().focus().mergeCells().run()}
          disabled={!canMergeCells()}
          icon={<Combine className="size-4" />}
          label="Merge cells"
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().splitCell().run()}
          disabled={!canSplitCell()}
          icon={<Split className="size-4" />}
          label="Split cell"
        />
      </div>

      <ToolbarSeparator />

      {/* Header toggles */}
      <div className="flex items-center gap-1">
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeaderRow().run()}
          isActive={editor.isActive('tableHeader')}
          icon={
            <div className="flex flex-col items-center gap-0.5">
              <Heading className="size-3" />
              <Minus className="size-3 rotate-0" />
            </div>
          }
          label="Toggle header row"
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeaderColumn().run()}
          icon={
            <div className="flex flex-col items-center gap-0.5">
              <Heading className="size-3" />
              <Minus className="size-3 rotate-90" />
            </div>
          }
          label="Toggle header column"
        />
      </div>

      <ToolbarSeparator />

      {/* Delete table */}
      <div className="flex items-center">
        <ToolbarButton
          onClick={() => editor.chain().focus().deleteTable().run()}
          icon={<Trash2 className="size-4 text-destructive" />}
          label="Delete table"
        />
      </div>
    </>
  );
}

/**
 * ContextMenu - Unified floating menu that shows text formatting or table controls
 *
 * Features:
 * - Automatically detects context (text selection vs table)
 * - Shows text formatting controls when text is selected
 * - Shows table controls when cursor is in a table
 * - Single BubbleMenu instance eliminates conflicts
 *
 * This replaces both FloatingToolbar and TableMenu with a single intelligent menu.
 *
 * @example
 * ```tsx
 * <ContextMenu editor={editor} />
 * ```
 */
export function ContextMenu({ editor }: ContextMenuProps) {
  // Track whether we're in a table - updates when editor state changes
  const [isInTable, setIsInTable] = useState(false);

  useEffect(() => {
    if (!editor) {
      return undefined;
    }

    // Update table state when editor changes
    const updateTableState = () => {
      setIsInTable(editor.isActive('table'));
    };

    // Initial check
    updateTableState();

    // Subscribe to editor updates
    editor.on('selectionUpdate', updateTableState);
    editor.on('update', updateTableState);

    return () => {
      editor.off('selectionUpdate', updateTableState);
      editor.off('update', updateTableState);
    };
  }, [editor]);

  if (!editor) {
    return null;
  }

  return (
    <BubbleMenu
      editor={editor}
      updateDelay={100}
      shouldShow={({ state, editor }) => {
        // Don't show if editor isn't ready
        if (!editor || !editor.isEditable) {
          return false;
        }
        // Show if text is selected
        if (!state.selection.empty) {
          return true;
        }
        // Or show if cursor is in a table
        if (editor.isActive('table')) {
          return true;
        }
        return false;
      }}
      appendTo={() => document.body}
      className="z-[100] flex gap-1 p-2 bg-popover border rounded-md shadow-md"
    >
      {/* Use state to determine which controls to show - properly reactive */}
      {isInTable ? (
        <TableControls editor={editor} />
      ) : (
        <TextFormattingControls editor={editor} />
      )}
    </BubbleMenu>
  );
}
