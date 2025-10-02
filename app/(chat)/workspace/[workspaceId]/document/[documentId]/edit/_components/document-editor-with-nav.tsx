'use client';

import { useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { DocumentEditor } from '@/components/document-editor';

interface DocumentEditorWithNavProps {
  workspaceId: string;
  documentId: string;
  initialContent: string;
  initialTitle: string;
}

export function DocumentEditorWithNav({
  workspaceId,
  documentId,
  initialContent,
  initialTitle,
}: DocumentEditorWithNavProps) {
  const router = useRouter();
  const editorRef = useRef<{ saveNow: () => Promise<void> }>(null);

  const handleBackClick = async () => {
    // Trigger immediate save before navigating
    if (editorRef.current?.saveNow) {
      await editorRef.current.saveNow();
    }
    router.push(`/workspace/${workspaceId}/document/${documentId}`);
  };

  return (
    <div className="container mx-auto py-6">
      <div className="flex items-center justify-between mb-4">
        <Button onClick={handleBackClick} variant="ghost">
          ← Back to Document
        </Button>

        <div className="text-sm text-muted-foreground">Auto-save enabled</div>
      </div>

      <DocumentEditor
        ref={editorRef}
        documentId={documentId}
        workspaceId={workspaceId}
        initialContent={initialContent}
        initialTitle={initialTitle}
      />
    </div>
  );
}
