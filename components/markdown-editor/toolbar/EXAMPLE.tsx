/**
 * Example: Using Markdown Editor with Toolbars
 *
 * This file demonstrates how to use the toolbar components with the
 * MarkdownEditorProvider.
 *
 * DO NOT IMPORT THIS FILE - It's for documentation purposes only.
 */

'use client';

import { EditorContent } from '@tiptap/react';
import {
  MarkdownEditorProvider,
  useMarkdownEditor,
} from '@/components/markdown-editor/providers/markdown-editor-provider';
import {
  InlineToolbar,
  FloatingToolbar,
} from '@/components/markdown-editor/toolbar';

/**
 * Example 1: Full-featured editor with both toolbars
 */
function FullFeaturedEditor() {
  const { editor } = useMarkdownEditor();

  return (
    <div className="border rounded-md overflow-hidden">
      {/* Fixed toolbar at top */}
      <InlineToolbar editor={editor} />

      {/* Floating toolbar appears on text selection */}
      <FloatingToolbar editor={editor} />

      {/* Editor content */}
      <EditorContent editor={editor} />
    </div>
  );
}

/**
 * Example 2: Minimal editor with floating toolbar only
 */
function MinimalEditor() {
  const { editor } = useMarkdownEditor();

  return (
    <div className="border rounded-md">
      <FloatingToolbar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
}

/**
 * Example 3: Complete page with provider
 */
export function MyEditorPage() {
  async function handleSave(id: string, content: string) {
    // Save to server
    const response = await fetch(`/api/documents/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ content }),
    });

    if (!response.ok) {
      return { error: 'Failed to save' };
    }

    return undefined; // Success
  }

  return (
    <MarkdownEditorProvider
      id="doc-123"
      initialContent="# My Document\n\nStart typing..."
      initialLastSaved={null}
      storageKey="doc-123-content"
      saveAction={handleSave}
      placeholder="Write something amazing..."
      ariaLabel="Document editor"
    >
      <FullFeaturedEditor />
    </MarkdownEditorProvider>
  );
}

/**
 * Example 4: Custom button set
 */
import {
  boldButton as boldBtn,
  italicButton as italicBtn,
  heading1Button as h1Btn,
  codeButton as codeBtn,
} from '@/components/markdown-editor/toolbar';

function CustomToolbarEditor() {
  const { editor } = useMarkdownEditor();

  // Only show bold, italic, H1, and code
  const customButtons = [boldBtn, italicBtn, h1Btn, codeBtn];

  return (
    <div className="border rounded-md">
      <InlineToolbar editor={editor} buttons={customButtons} />
      <EditorContent editor={editor} />
    </div>
  );
}
