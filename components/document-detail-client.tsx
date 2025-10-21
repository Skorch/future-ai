'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { SidebarToggle } from '@/components/sidebar-toggle';
import { DocumentHeader } from '@/components/document-header';
import { DocumentHeaderProvider } from '@/components/document-header/providers';
import { DocumentViewer } from '@/components/document-viewer';
import { useSidebar } from '@/components/ui/sidebar';
import { useWindowSize } from 'usehooks-ts';
import { logger } from '@/lib/logger';
import { toast } from 'sonner';

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
  objectiveId?: string;
  documentType: 'knowledge' | 'objective';
}

export function DocumentDetailClient({
  workspaceId,
  document,
  objectiveId,
  documentType,
}: DocumentDetailClientProps) {
  const router = useRouter();
  const { open } = useSidebar();
  const { width } = useWindowSize();

  // Determine back navigation based on context
  const backHref = objectiveId
    ? `/workspace/${workspaceId}/objective/${objectiveId}`
    : `/workspace/${workspaceId}/document`;
  const backLabel = objectiveId ? 'Objective' : 'Documents';

  return (
    <div className="container mx-auto py-6">
      <div className="mb-4 flex items-center gap-2">
        {(!open || width < 768) && <SidebarToggle />}
        <Button asChild variant="ghost">
          <Link href={backHref}>← Back to {backLabel}</Link>
        </Button>
      </div>

      <DocumentHeaderProvider
        document={{
          id: document.id,
          title: document.title,
          isSearchable: document.isSearchable,
        }}
        workspaceId={workspaceId}
        documentType={documentType}
        onNavigate={(url) => {
          try {
            router.push(url);
          } catch (error) {
            logger.error('Navigation failed', { url, error });
            toast.error('Failed to navigate');
          }
        }}
        onRefresh={() => router.refresh()}
        onDeleteSuccess={() => {
          const targetRoute =
            documentType === 'knowledge'
              ? `/workspace/${workspaceId}`
              : `/workspace/${workspaceId}/document`;
          router.push(targetRoute);
        }}
      >
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
        />
      </DocumentHeaderProvider>

      <div className="border rounded-lg bg-card">
        <DocumentViewer content={document.content} />
      </div>
    </div>
  );
}
