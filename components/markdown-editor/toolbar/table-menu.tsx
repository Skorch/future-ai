'use client';

import type { Editor } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import { ToolbarButton, ToolbarSeparator } from './toolbar-buttons';
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

interface TableMenuProps {
  editor: Editor | null;
}

/**
 * TableMenu - Floating menu for table operations
 *
 * Features:
 * - Only appears when cursor is inside a table
 * - Row operations: add before/after, delete
 * - Column operations: add before/after, delete
 * - Cell operations: merge, split
 * - Header toggles: row and column headers
 * - Table operations: delete entire table
 *
 * @example
 * ```tsx
 * <TableMenu editor={editor} />
 * ```
 */
export function TableMenu({ editor }: TableMenuProps) {
  if (!editor) {
    return null;
  }

  /**
   * Only show when cursor is inside a table
   */
  const shouldShow = () => {
    return editor.isActive('table');
  };

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
    <BubbleMenu
      editor={editor}
      updateDelay={100}
      shouldShow={shouldShow}
      appendTo={() => document.body}
      className="z-[100] flex gap-1 p-2 bg-popover border rounded-md shadow-md"
    >
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
    </BubbleMenu>
  );
}
