'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import TiptapStarterKit from '@tiptap/starter-kit';
import { Markdown } from 'tiptap-markdown';

interface DocumentViewerProps {
  content: string;
}

export function DocumentViewer({ content }: DocumentViewerProps) {
  const editor = useEditor({
    extensions: [
      TiptapStarterKit,
      Markdown.configure({
        html: true, // Allow HTML in markdown
        tightLists: true, // Clean list formatting
        transformPastedText: false, // Read-only, no paste needed
        transformCopiedText: false, // No copy as markdown needed
      }),
    ],
    content: content || '',
    editable: false,
    immediatelyRender: false, // Critical for Next.js SSR compatibility
    editorProps: {
      attributes: {
        class: 'prose dark:prose-invert max-w-none focus:outline-none p-6',
      },
    },
  });

  if (!editor) {
    return <div className="p-6 text-muted-foreground">Loading document...</div>;
  }

  return <EditorContent editor={editor} />;
}
