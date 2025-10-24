'use client';

import type { Editor } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import { ToolbarButton, ToolbarSeparator } from './toolbar-buttons';
import {
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
  type ToolbarButtonConfig,
} from './toolbar-buttons';

interface FloatingToolbarProps {
  editor: Editor | null;
  buttons?: ToolbarButtonConfig[]; // Optional: customize which buttons to show
}

/**
 * Default buttons for floating toolbar (text selection)
 *
 * Organized into groups:
 * - Text formatting: Bold, Italic, Strike
 * - Headings: H1, H2, H3 (desktop only)
 * - Lists: Bullet list, Ordered list, Task list
 * - Code: Code, Blockquote
 * - Insert: Link, Table
 * - Actions: Clear formatting
 */
const defaultFloatingButtons = [
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

/**
 * FloatingToolbar - Appears when text is selected using BubbleMenu
 *
 * Features:
 * - Shows formatting options when text is selected
 * - Positioned near the selection automatically
 * - Responsive: shows all buttons on desktop, essential on mobile
 * - Uses TipTap's BubbleMenu component
 *
 * @example
 * ```tsx
 * <FloatingToolbar editor={editor} />
 * ```
 */
export function FloatingToolbar({
  editor,
  buttons = defaultFloatingButtons,
}: FloatingToolbarProps) {
  if (!editor) {
    return null;
  }

  return (
    <BubbleMenu
      editor={editor}
      updateDelay={100}
      shouldShow={({ editor, state }) => {
        // Don't show if nothing is selected
        if (state.selection.empty) {
          return false;
        }
        // Don't show if we're in a table (TableMenu handles that)
        if (editor.isActive('table')) {
          return false;
        }
        return true;
      }}
      appendTo={() => document.body}
      className="z-[100] flex gap-1 p-2 bg-popover border rounded-md shadow-md"
    >
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
    </BubbleMenu>
  );
}

/**
 * FloatingToolbarMinimal - Minimal floating toolbar with only essential buttons
 *
 * @example
 * ```tsx
 * <FloatingToolbarMinimal editor={editor} />
 * ```
 */
export function FloatingToolbarMinimal({
  editor,
}: {
  editor: Editor | null;
}) {
  if (!editor) {
    return null;
  }

  const minimalButtons = [
    boldButton,
    italicButton,
    heading1Button,
    codeButton,
    linkButton,
  ];

  return <FloatingToolbar editor={editor} buttons={minimalButtons} />;
}
