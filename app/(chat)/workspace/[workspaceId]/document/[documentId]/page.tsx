import { auth } from '@clerk/nextjs/server';
import { redirect, notFound } from 'next/navigation';
import { getDocumentWithVersions } from '@/lib/db/documents';
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

  const docWithVersions = await getDocumentWithVersions(documentId);

  if (
    !docWithVersions ||
    docWithVersions.envelope.workspaceId !== workspaceId
  ) {
    notFound();
  }

  // Show published version by default, or draft if no published exists
  const versionToShow =
    docWithVersions.currentPublished || docWithVersions.currentDraft;

  if (!versionToShow) {
    notFound();
  }

  // Calculate contentLength for the document
  const contentLength = versionToShow.content?.length || 0;

  return (
    <DocumentDetailClient
      workspaceId={workspaceId}
      document={{
        id: docWithVersions.envelope.id,
        title: docWithVersions.envelope.title,
        metadata: versionToShow.metadata as { documentType?: string },
        createdAt: versionToShow.createdAt,
        contentLength,
        isSearchable: docWithVersions.envelope.isSearchable,
        content: versionToShow.content || '',
      }}
    />
  );
}
