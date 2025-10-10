'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { SidebarToggle } from '@/components/sidebar-toggle';
import { DocumentHeader } from '@/components/document-header';
import { DocumentViewer } from '@/components/document-viewer';
import { useSidebar } from '@/components/ui/sidebar';
import { useWindowSize } from 'usehooks-ts';

interface DocumentDetailClientProps {
  workspaceId: string;
  document: {
    id: string;
    title: string;
    metadata: { documentType?: string };
    createdAt: Date;
    contentLength: number;
    isSearchable?: boolean; // Optional - only for KnowledgeDocuments
    content: string;
  };
}

export function DocumentDetailClient({
  workspaceId,
  document,
}: DocumentDetailClientProps) {
  const { open } = useSidebar();
  const { width } = useWindowSize();

  return (
    <div className="container mx-auto py-6">
      <div className="mb-4 flex items-center gap-2">
        {(!open || width < 768) && <SidebarToggle />}
        <Button asChild variant="ghost">
          <Link href={`/workspace/${workspaceId}/document`}>
            ← Back to Documents
          </Link>
        </Button>
      </div>

      <DocumentHeader
        document={{
          id: document.id,
          title: document.title,
          metadata: document.metadata,
          createdAt: document.createdAt,
          contentLength: document.contentLength,
          ...(document.isSearchable !== undefined && {
            isSearchable: document.isSearchable,
          }),
        }}
        workspaceId={workspaceId}
      />

      <div className="border rounded-lg bg-card">
        <DocumentViewer content={document.content} />
      </div>
    </div>
  );
}
