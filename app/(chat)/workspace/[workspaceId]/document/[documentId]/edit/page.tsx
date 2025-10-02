import { auth } from '@clerk/nextjs/server';
import { redirect, notFound } from 'next/navigation';
import { getDocumentsById } from '@/lib/db/documents';
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

  const documents = await getDocumentsById({ id: documentId, workspaceId });

  if (!documents || documents.length === 0) {
    notFound();
  }

  // Get the most recent version
  const document = documents[documents.length - 1];

  return (
    <DocumentEditorWithNav
      workspaceId={workspaceId}
      documentId={documentId}
      initialContent={document.content || ''}
      initialTitle={document.title}
    />
  );
}
