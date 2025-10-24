'use client';

import type { Editor } from '@tiptap/react';
import { ToolbarButton, ToolbarSeparator } from './toolbar-buttons';
import {
  boldButton,
  italicButton,
  strikeButton,
  heading1Button,
  heading2Button,
  heading3Button,
  heading4Button,
  heading5Button,
  heading6Button,
  bulletListButton,
  orderedListButton,
  taskListButton,
  codeButton,
  codeBlockButton,
  blockquoteButton,
  horizontalRuleButton,
  linkButton,
  tableButton,
  undoButton,
  redoButton,
  clearFormattingButton,
  type ToolbarButtonConfig,
} from './toolbar-buttons';

interface InlineToolbarProps {
  editor: Editor | null;
  buttons?: ToolbarButtonConfig[]; // Optional: customize which buttons to show
}

/**
 * Default buttons for inline toolbar (fixed at top)
 */
const defaultInlineButtons = [
  // Text formatting
  boldButton,
  italicButton,
  strikeButton,
  // Headings
  heading1Button,
  heading2Button,
  heading3Button,
  heading4Button,
  heading5Button,
  heading6Button,
  // Lists
  bulletListButton,
  orderedListButton,
  taskListButton,
  // Code
  codeButton,
  codeBlockButton,
  // Blockquote and horizontal rule
  blockquoteButton,
  horizontalRuleButton,
  // Links and tables
  linkButton,
  tableButton,
  // Undo/Redo
  undoButton,
  redoButton,
  // Clear
  clearFormattingButton,
];

/**
 * InlineToolbar - Fixed toolbar at top of editor
 *
 * Features:
 * - Fixed positioning at top of editor
 * - Semi-transparent background for visual hierarchy
 * - Responsive: shows all buttons on desktop, essential on mobile
 * - Grouped by function with separators
 *
 * @example
 * ```tsx
 * <InlineToolbar editor={editor} />
 * ```
 */
export function InlineToolbar({
  editor,
  buttons = defaultInlineButtons,
}: InlineToolbarProps) {
  if (!editor) {
    return null;
  }

  // Filter buttons for mobile
  const mobileButtons = buttons.filter(
    (button) =>
      !button.desktop ||
      button.key === 'bold' ||
      button.key === 'italic' ||
      button.key === 'h1' ||
      button.key === 'bulletList' ||
      button.key === 'code',
  );

  return (
    <div className="flex gap-1 p-2 border-b bg-muted/50 overflow-x-auto">
      {/* Desktop: Show all buttons with proper grouping */}
      <div className="hidden md:flex gap-1">
        {buttons.map((button, index) => {
          // Determine if we should show a separator before this button
          const showSeparatorBefore =
            button.key === 'h1' ||
            button.key === 'bulletList' ||
            button.key === 'code' ||
            button.key === 'blockquote' ||
            button.key === 'link' ||
            button.key === 'undo' ||
            button.key === 'clearFormatting';

          return (
            <div key={button.key} className="flex items-center">
              {showSeparatorBefore && index > 0 && <ToolbarSeparator />}
              <ToolbarButton
                onClick={() => button.onClick(editor)}
                isActive={button.isActive(editor)}
                disabled={
                  (button.key === 'undo' && !editor.can().undo()) ||
                  (button.key === 'redo' && !editor.can().redo())
                }
                icon={button.icon}
                label={button.label}
              />
            </div>
          );
        })}
      </div>

      {/* Mobile: Show essential buttons only */}
      <div className="flex md:hidden gap-1">
        {mobileButtons.map((button, index) => {
          // Add separator before headings and lists on mobile
          const showSeparatorBefore =
            button.key === 'h1' || button.key === 'bulletList';

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
    </div>
  );
}

/**
 * InlineToolbarMinimal - Minimal inline toolbar with only essential buttons
 *
 * @example
 * ```tsx
 * <InlineToolbarMinimal editor={editor} />
 * ```
 */
export function InlineToolbarMinimal({ editor }: { editor: Editor | null }) {
  if (!editor) {
    return null;
  }

  const minimalButtons = [
    boldButton,
    italicButton,
    heading1Button,
    bulletListButton,
    codeButton,
  ];

  return <InlineToolbar editor={editor} buttons={minimalButtons} />;
}

/**
 * InlineToolbarCompact - Compact inline toolbar without advanced features
 * (no tables, task lists, etc.)
 *
 * @example
 * ```tsx
 * <InlineToolbarCompact editor={editor} />
 * ```
 */
export function InlineToolbarCompact({ editor }: { editor: Editor | null }) {
  if (!editor) {
    return null;
  }

  const compactButtons = [
    boldButton,
    italicButton,
    strikeButton,
    heading1Button,
    heading2Button,
    heading3Button,
    heading4Button,
    heading5Button,
    heading6Button,
    bulletListButton,
    orderedListButton,
    taskListButton,
    codeButton,
    codeBlockButton,
    blockquoteButton,
    linkButton,
  ];

  return <InlineToolbar editor={editor} buttons={compactButtons} />;
}
