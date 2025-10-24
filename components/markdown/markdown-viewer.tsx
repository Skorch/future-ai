'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import TiptapStarterKit from '@tiptap/starter-kit';
import { Markdown } from 'tiptap-markdown';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { Link } from '@tiptap/extension-link';
import { cn } from '@/lib/utils';

interface MarkdownViewerProps {
  content: string;
  className?: string;
}

export function MarkdownViewer({ content, className }: MarkdownViewerProps) {
  const editor = useEditor({
    extensions: [
      TiptapStarterKit,
      Markdown.configure({
        html: true,
        tightLists: true,
        transformPastedText: false,
        transformCopiedText: false,
      }),
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
      Table.configure({
        resizable: false,
      }),
      TableRow,
      TableCell,
      TableHeader,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class:
            'text-primary underline underline-offset-4 hover:text-primary/80',
        },
      }),
    ],
    content: content || '',
    editable: false,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: cn(
          'prose dark:prose-invert max-w-none focus:outline-none',
          'prose-headings:font-semibold',
          'prose-a:text-primary prose-a:no-underline hover:prose-a:underline',
          'prose-pre:bg-muted prose-pre:text-foreground',
          'prose-code:text-foreground prose-code:bg-muted prose-code:rounded prose-code:px-1',
          'prose-table:border prose-table:border-border',
          'prose-th:border prose-th:border-border prose-th:bg-muted/50',
          'prose-td:border prose-td:border-border',
          className,
        ),
      },
    },
  });

  if (!editor) {
    return <div className="text-muted-foreground">Loading markdown...</div>;
  }

  return <EditorContent editor={editor} />;
}
