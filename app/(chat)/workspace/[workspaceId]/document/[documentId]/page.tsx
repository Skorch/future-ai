import { auth } from '@clerk/nextjs/server';
import { redirect, notFound } from 'next/navigation';
import { getObjectiveDocumentById } from '@/lib/db/objective-document';
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

  const docWithVersions = await getObjectiveDocumentById(documentId);

  if (
    !docWithVersions ||
    docWithVersions.document.workspaceId !== workspaceId
  ) {
    notFound();
  }

  // Show latest version
  const versionToShow = docWithVersions.latestVersion;

  if (!versionToShow) {
    // No versions exist yet
    notFound();
  }

  // Calculate contentLength for the document
  const contentLength = versionToShow.content?.length || 0;

  return (
    <DocumentDetailClient
      workspaceId={workspaceId}
      document={{
        id: docWithVersions.document.id,
        title: docWithVersions.document.title,
        metadata: (versionToShow.metadata as { documentType?: string }) || {},
        createdAt: versionToShow.createdAt,
        contentLength,
        // Don't pass isSearchable - ObjectiveDocuments don't have this field
        content: versionToShow.content || '',
      }}
      documentType="objective"
      // ObjectiveDocument doesn't have objectiveId field - navigates to /documents
      objectiveId={undefined}
    />
  );
}
