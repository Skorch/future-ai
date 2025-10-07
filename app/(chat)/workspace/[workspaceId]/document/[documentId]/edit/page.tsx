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

  // ONLY edit published version on this route
  // Drafts are only editable in the artifact/chat interface
  // When you save here, it creates a NEW published version
  const versionToEdit = docWithVersions.currentPublished;

  if (!versionToEdit) {
    // No published version exists - document hasn't been published yet
    // Can't edit an unpublished document on this route
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
