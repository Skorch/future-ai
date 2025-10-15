'use client';

import { useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { DocumentEditor } from '@/components/document-editor';
import { SidebarToggle } from '@/components/sidebar-toggle';
import { useSidebar } from '@/components/ui/sidebar';
import { useWindowSize } from 'usehooks-ts';

interface DocumentEditorWithNavProps {
  workspaceId: string;
  documentId: string;
  initialContent: string;
  initialTitle: string;
  documentType: 'knowledge' | 'objective';
  backRoute?: string;
}

export function DocumentEditorWithNav({
  workspaceId,
  documentId,
  initialContent,
  initialTitle,
  documentType,
  backRoute,
}: DocumentEditorWithNavProps) {
  const router = useRouter();
  const editorRef = useRef<{ saveNow: () => Promise<void> }>(null);
  const { open } = useSidebar();
  const { width } = useWindowSize();

  const handleBackClick = async () => {
    // Trigger immediate save before navigating
    if (editorRef.current?.saveNow) {
      await editorRef.current.saveNow();
    }

    // Use custom backRoute if provided, otherwise use default based on documentType
    const defaultBackRoute =
      documentType === 'knowledge'
        ? `/workspace/${workspaceId}/knowledge/${documentId}`
        : `/workspace/${workspaceId}/document/${documentId}`;

    router.push(backRoute || defaultBackRoute);
  };

  return (
    <div className="container mx-auto py-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {(!open || width < 768) && <SidebarToggle />}
          <Button onClick={handleBackClick} variant="ghost">
            ← Back to Document
          </Button>
        </div>

        <div className="text-sm text-muted-foreground">Auto-save enabled</div>
      </div>

      <DocumentEditor
        ref={editorRef}
        documentId={documentId}
        workspaceId={workspaceId}
        initialContent={initialContent}
        initialTitle={initialTitle}
        documentType={documentType}
      />
    </div>
  );
}
