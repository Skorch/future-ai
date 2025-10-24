'use client';

import { exampleSetup } from 'prosemirror-example-setup';
import { inputRules } from 'prosemirror-inputrules';
import { EditorState } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import React, { memo, useCallback, useEffect, useRef, useState } from 'react';

import { MarkdownEditor } from '@/components/markdown';
import {
  documentSchema,
  handleTransaction,
  headingRule,
} from '@/lib/editor/config';
import {
  buildContentFromDocument,
  buildDocumentFromContent,
} from '@/lib/editor/functions';

type EditorProps = {
  content: string;
  onSaveContent: (updatedContent: string, debounce: boolean) => void;
  status: 'streaming' | 'idle';
  isCurrentVersion: boolean;
  currentVersionIndex: number;
};

/**
 * ProseMirror editor for streaming mode
 * Handles real-time updates during AI streaming responses
 */
function StreamingEditor({
  content,
  onSaveContent,
}: {
  content: string;
  onSaveContent: (updatedContent: string, debounce: boolean) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<EditorView | null>(null);

  useEffect(() => {
    if (containerRef.current && !editorRef.current) {
      const state = EditorState.create({
        doc: buildDocumentFromContent(content),
        plugins: [
          ...exampleSetup({ schema: documentSchema, menuBar: false }),
          inputRules({
            rules: [
              headingRule(1),
              headingRule(2),
              headingRule(3),
              headingRule(4),
              headingRule(5),
              headingRule(6),
            ],
          }),
        ],
      });

      editorRef.current = new EditorView(containerRef.current, {
        state,
      });
    }

    return () => {
      if (editorRef.current) {
        editorRef.current.destroy();
        editorRef.current = null;
      }
    };
    // NOTE: we only want to run this effect once
    // eslint-disable-next-line
  }, []);

  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.setProps({
        dispatchTransaction: (transaction) => {
          handleTransaction({
            transaction,
            editorRef,
            onSaveContent,
          });
        },
      });
    }
  }, [onSaveContent]);

  useEffect(() => {
    if (editorRef.current && content) {
      const currentContent = buildContentFromDocument(
        editorRef.current.state.doc,
      );

      // Always replace content during streaming
      const newDocument = buildDocumentFromContent(content);

      const transaction = editorRef.current.state.tr.replaceWith(
        0,
        editorRef.current.state.doc.content.size,
        newDocument.content,
      );

      transaction.setMeta('no-save', true);
      editorRef.current.dispatch(transaction);
    }
  }, [content]);

  return (
    <div className="relative prose dark:prose-invert" ref={containerRef} />
  );
}

/**
 * TipTap editor for idle/editing mode
 * Provides rich editing features with toolbar
 */
function EditingEditor({
  content,
  onSaveContent,
}: {
  content: string;
  onSaveContent: (updatedContent: string, debounce: boolean) => void;
}) {
  const handleChange = useCallback(
    (updatedContent: string) => {
      // Call with debounce=true for auto-save during editing
      onSaveContent(updatedContent, true);
    },
    [onSaveContent],
  );

  return (
    <MarkdownEditor
      value={content}
      onChange={handleChange}
      placeholder=""
      showToolbar={true}
      toolbarMode="floating"
      autoSave={false} // We handle saving via onChange callback
      showCharacterCount={false} // Keep UI minimal
      features={['all']}
      className="relative"
    />
  );
}

/**
 * Hybrid editor that switches between ProseMirror (streaming) and TipTap (editing)
 */
function PureEditor({ content, onSaveContent, status }: EditorProps) {
  // Track content across mode switches to prevent data loss
  const contentRef = useRef(content);

  // Update ref when content changes externally
  useEffect(() => {
    contentRef.current = content;
  }, [content]);

  // Create a stable callback that always uses the latest content from ref
  const handleSaveContent = useCallback(
    (updatedContent: string, debounce: boolean) => {
      // Update our ref to track the latest content
      contentRef.current = updatedContent;
      // Forward to parent
      onSaveContent(updatedContent, debounce);
    },
    [onSaveContent],
  );

  // Use the content from ref for initial render, then use prop
  const [editorContent, setEditorContent] = useState(content);

  useEffect(() => {
    // When switching modes or content changes, update editor content
    setEditorContent(contentRef.current);
  }, [status, content]);

  return status === 'streaming' ? (
    <StreamingEditor
      content={editorContent}
      onSaveContent={handleSaveContent}
    />
  ) : (
    <EditingEditor content={editorContent} onSaveContent={handleSaveContent} />
  );
}

function areEqual(prevProps: EditorProps, nextProps: EditorProps) {
  return (
    prevProps.currentVersionIndex === nextProps.currentVersionIndex &&
    prevProps.isCurrentVersion === nextProps.isCurrentVersion &&
    !(prevProps.status === 'streaming' && nextProps.status === 'streaming') &&
    prevProps.content === nextProps.content &&
    prevProps.onSaveContent === nextProps.onSaveContent
  );
}

export const Editor = memo(PureEditor, areEqual);
