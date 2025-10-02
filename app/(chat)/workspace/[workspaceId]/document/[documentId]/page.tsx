import { auth } from '@clerk/nextjs/server';
import { redirect, notFound } from 'next/navigation';
import { getDocumentsById } from '@/lib/db/documents';
import { DocumentDetailClient } from '@/components/document-detail-client';

export default async function DocumentDetailPage({
  params,
}: {
  params: Promise<{ workspaceId: string; documentId: string }>;
}) {
  const { workspaceId, documentId } = await params;
  const { userId } = await auth();

  if (!userId) {
    redirect('/login');
  }

  const documents = await getDocumentsById({ id: documentId, workspaceId });

  if (!documents || documents.length === 0) {
    notFound();
  }

  // Get the most recent version
  const document = documents[documents.length - 1];

  // Calculate contentLength for the document
  const contentLength = document.content?.length || 0;

  return (
    <DocumentDetailClient
      workspaceId={workspaceId}
      document={{
        id: document.id,
        title: document.title,
        metadata: document.metadata as { documentType?: string },
        createdAt: document.createdAt,
        contentLength,
        isSearchable: document.isSearchable,
        content: document.content || '',
      }}
    />
  );
}
