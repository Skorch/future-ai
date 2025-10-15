import { auth } from '@clerk/nextjs/server';
import { redirect, notFound } from 'next/navigation';
import { getObjectiveDocumentById } from '@/lib/db/objective-document';
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

  const docWithVersions = await getObjectiveDocumentById(documentId);

  if (
    !docWithVersions ||
    docWithVersions.document.workspaceId !== workspaceId
  ) {
    notFound();
  }

  // Edit latest version
  const versionToEdit = docWithVersions.latestVersion;

  if (!versionToEdit) {
    // No version exists
    notFound();
  }

  return (
    <DocumentEditorWithNav
      workspaceId={workspaceId}
      documentId={documentId}
      initialContent={versionToEdit.content || ''}
      initialTitle={docWithVersions.document.title}
      documentType="objective"
    />
  );
}
