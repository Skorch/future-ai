import { auth } from '@clerk/nextjs/server';
import { redirect, notFound } from 'next/navigation';
import { getDocumentWithVersions } from '@/lib/db/documents';
import { DocumentEditorWithNav } from './_components/document-editor-with-nav';

export default async function DocumentEditPage({
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

  // Edit the current draft version (or published if no draft exists)
  const versionToEdit =
    docWithVersions.currentDraft || docWithVersions.currentPublished;

  if (!versionToEdit) {
    notFound();
  }

  return (
    <DocumentEditorWithNav
      workspaceId={workspaceId}
      documentId={documentId}
      initialContent={versionToEdit.content || ''}
      initialTitle={docWithVersions.envelope.title}
    />
  );
}
