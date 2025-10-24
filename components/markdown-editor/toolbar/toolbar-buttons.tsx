'use client';

import type { Editor } from '@tiptap/react';
import {
  Bold,
  Italic,
  Strikethrough,
  Heading1,
  Heading2,
  Heading3,
  Heading4,
  Heading5,
  Heading6,
  List,
  ListOrdered,
  ListTodo,
  Code,
  Code2,
  Link,
  Table,
  Quote,
  SeparatorHorizontal,
  Undo,
  Redo,
  RemoveFormatting,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ToolbarButtonProps {
  onClick: () => void;
  isActive?: boolean;
  disabled?: boolean;
  icon: React.ReactNode;
  label: string;
}

/**
 * Reusable toolbar button component
 */
export function ToolbarButton({
  onClick,
  isActive = false,
  disabled = false,
  icon,
  label,
}: ToolbarButtonProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={onClick}
      disabled={disabled}
      className={cn(isActive ? 'bg-muted' : '')}
      aria-label={label}
    >
      {icon}
    </Button>
  );
}

/**
 * Toolbar separator (vertical divider)
 */
export function ToolbarSeparator() {
  return <div className="w-px h-6 bg-border mx-1" />;
}

// =============================================================================
// Toolbar Button Configurations
// =============================================================================

export interface ToolbarButtonConfig {
  key: string;
  icon: React.ReactNode;
  label: string;
  isActive: (editor: Editor) => boolean;
  onClick: (editor: Editor) => void;
  desktop?: boolean; // Only show on desktop (>768px)
  mobile?: boolean; // Only show on mobile (<=768px)
}

/**
 * Bold button
 */
export const boldButton: ToolbarButtonConfig = {
  key: 'bold',
  icon: <Bold className="size-4" />,
  label: 'Bold',
  isActive: (editor) => editor.isActive('bold'),
  onClick: (editor) => editor.chain().focus().toggleBold().run(),
};

/**
 * Italic button
 */
export const italicButton: ToolbarButtonConfig = {
  key: 'italic',
  icon: <Italic className="size-4" />,
  label: 'Italic',
  isActive: (editor) => editor.isActive('italic'),
  onClick: (editor) => editor.chain().focus().toggleItalic().run(),
};

/**
 * Strikethrough button
 */
export const strikeButton: ToolbarButtonConfig = {
  key: 'strike',
  icon: <Strikethrough className="size-4" />,
  label: 'Strikethrough',
  isActive: (editor) => editor.isActive('strike'),
  onClick: (editor) => editor.chain().focus().toggleStrike().run(),
  desktop: true,
};

/**
 * Heading 1 button
 */
export const heading1Button: ToolbarButtonConfig = {
  key: 'h1',
  icon: <Heading1 className="size-4" />,
  label: 'Heading 1',
  isActive: (editor) => editor.isActive('heading', { level: 1 }),
  onClick: (editor) => editor.chain().focus().toggleHeading({ level: 1 }).run(),
};

/**
 * Heading 2 button
 */
export const heading2Button: ToolbarButtonConfig = {
  key: 'h2',
  icon: <Heading2 className="size-4" />,
  label: 'Heading 2',
  isActive: (editor) => editor.isActive('heading', { level: 2 }),
  onClick: (editor) => editor.chain().focus().toggleHeading({ level: 2 }).run(),
  desktop: true,
};

/**
 * Heading 3 button
 */
export const heading3Button: ToolbarButtonConfig = {
  key: 'h3',
  icon: <Heading3 className="size-4" />,
  label: 'Heading 3',
  isActive: (editor) => editor.isActive('heading', { level: 3 }),
  onClick: (editor) => editor.chain().focus().toggleHeading({ level: 3 }).run(),
  desktop: true,
};

/**
 * Heading 4 button
 */
export const heading4Button: ToolbarButtonConfig = {
  key: 'h4',
  icon: <Heading4 className="size-4" />,
  label: 'Heading 4',
  isActive: (editor) => editor.isActive('heading', { level: 4 }),
  onClick: (editor) => editor.chain().focus().toggleHeading({ level: 4 }).run(),
  desktop: true,
};

/**
 * Heading 5 button
 */
export const heading5Button: ToolbarButtonConfig = {
  key: 'h5',
  icon: <Heading5 className="size-4" />,
  label: 'Heading 5',
  isActive: (editor) => editor.isActive('heading', { level: 5 }),
  onClick: (editor) => editor.chain().focus().toggleHeading({ level: 5 }).run(),
  desktop: true,
};

/**
 * Heading 6 button
 */
export const heading6Button: ToolbarButtonConfig = {
  key: 'h6',
  icon: <Heading6 className="size-4" />,
  label: 'Heading 6',
  isActive: (editor) => editor.isActive('heading', { level: 6 }),
  onClick: (editor) => editor.chain().focus().toggleHeading({ level: 6 }).run(),
  desktop: true,
};

/**
 * Bullet list button
 */
export const bulletListButton: ToolbarButtonConfig = {
  key: 'bulletList',
  icon: <List className="size-4" />,
  label: 'Bullet list',
  isActive: (editor) => editor.isActive('bulletList'),
  onClick: (editor) => editor.chain().focus().toggleBulletList().run(),
};

/**
 * Ordered list button
 */
export const orderedListButton: ToolbarButtonConfig = {
  key: 'orderedList',
  icon: <ListOrdered className="size-4" />,
  label: 'Ordered list',
  isActive: (editor) => editor.isActive('orderedList'),
  onClick: (editor) => editor.chain().focus().toggleOrderedList().run(),
  desktop: true,
};

/**
 * Task list button
 */
export const taskListButton: ToolbarButtonConfig = {
  key: 'taskList',
  icon: <ListTodo className="size-4" />,
  label: 'Task list',
  isActive: (editor) => editor.isActive('taskList'),
  onClick: (editor) => editor.chain().focus().toggleTaskList().run(),
  desktop: true,
};

/**
 * Inline code button
 */
export const codeButton: ToolbarButtonConfig = {
  key: 'code',
  icon: <Code className="size-4" />,
  label: 'Inline code',
  isActive: (editor) => editor.isActive('code'),
  onClick: (editor) => editor.chain().focus().toggleCode().run(),
};

/**
 * Code block button
 */
export const codeBlockButton: ToolbarButtonConfig = {
  key: 'codeBlock',
  icon: <Code2 className="size-4" />,
  label: 'Code block',
  isActive: (editor) => editor.isActive('codeBlock'),
  onClick: (editor) => editor.chain().focus().toggleCodeBlock().run(),
  desktop: true,
};

/**
 * Blockquote button
 */
export const blockquoteButton: ToolbarButtonConfig = {
  key: 'blockquote',
  icon: <Quote className="size-4" />,
  label: 'Blockquote',
  isActive: (editor) => editor.isActive('blockquote'),
  onClick: (editor) => editor.chain().focus().toggleBlockquote().run(),
  desktop: true,
};

/**
 * Horizontal rule button
 */
export const horizontalRuleButton: ToolbarButtonConfig = {
  key: 'horizontalRule',
  icon: <SeparatorHorizontal className="size-4" />,
  label: 'Horizontal rule',
  isActive: () => false,
  onClick: (editor) => editor.chain().focus().setHorizontalRule().run(),
  desktop: true,
};

/**
 * Link button
 */
export const linkButton: ToolbarButtonConfig = {
  key: 'link',
  icon: <Link className="size-4" />,
  label: 'Link',
  isActive: (editor) => editor.isActive('link'),
  onClick: (editor) => {
    const previousUrl = editor.getAttributes('link').href;
    const url = window.prompt('URL', previousUrl);

    // Cancelled
    if (url === null) {
      return;
    }

    // Empty string = remove link
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }

    // Set link
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  },
  desktop: true,
};

/**
 * Table button (insert 3x3 table)
 */
export const tableButton: ToolbarButtonConfig = {
  key: 'table',
  icon: <Table className="size-4" />,
  label: 'Insert table',
  isActive: (editor) => editor.isActive('table'),
  onClick: (editor) =>
    editor
      .chain()
      .focus()
      .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
      .run(),
  desktop: true,
};

/**
 * Undo button
 */
export const undoButton: ToolbarButtonConfig = {
  key: 'undo',
  icon: <Undo className="size-4" />,
  label: 'Undo',
  isActive: () => false,
  onClick: (editor) => editor.chain().focus().undo().run(),
  desktop: true,
};

/**
 * Redo button
 */
export const redoButton: ToolbarButtonConfig = {
  key: 'redo',
  icon: <Redo className="size-4" />,
  label: 'Redo',
  isActive: () => false,
  onClick: (editor) => editor.chain().focus().redo().run(),
  desktop: true,
};

/**
 * Clear formatting button
 */
export const clearFormattingButton: ToolbarButtonConfig = {
  key: 'clearFormatting',
  icon: <RemoveFormatting className="size-4" />,
  label: 'Clear formatting',
  isActive: () => false,
  onClick: (editor) =>
    editor.chain().focus().clearNodes().unsetAllMarks().run(),
  desktop: true,
};

// =============================================================================
// Button Collections
// =============================================================================

/**
 * All toolbar buttons
 */
export const allButtons: ToolbarButtonConfig[] = [
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
];

/**
 * Essential buttons for mobile/minimal UI
 */
export const essentialButtons: ToolbarButtonConfig[] = [
  boldButton,
  italicButton,
  heading1Button,
  bulletListButton,
  taskListButton,
  codeButton,
];
