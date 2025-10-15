import { auth } from '@clerk/nextjs/server';
import { redirect, notFound } from 'next/navigation';
import { getKnowledgeDocumentById } from '@/lib/db/knowledge-document';
import { DocumentEditorWithNav } from '../../../document/[documentId]/edit/_components/document-editor-with-nav';

export default async function KnowledgeEditPage({
  params,
}: {
  params: Promise<{ workspaceId: string; knowledgeId: string }>;
}) {
  const { workspaceId, knowledgeId } = await params;
  const { userId } = await auth();

  if (!userId) {
    redirect('/login');
  }

  const doc = await getKnowledgeDocumentById(knowledgeId);

  if (!doc || doc.workspaceId !== workspaceId) {
    notFound();
  }

  return (
    <DocumentEditorWithNav
      workspaceId={workspaceId}
      documentId={knowledgeId}
      initialContent={doc.content || ''}
      initialTitle={doc.title}
      documentType="knowledge"
    />
  );
}
