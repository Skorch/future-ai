import { auth } from '@clerk/nextjs/server';
import { redirect, notFound } from 'next/navigation';
import { getKnowledgeDocumentById } from '@/lib/db/knowledge-document';
import { DocumentDetailClient } from '@/components/document-detail-client';

export default async function KnowledgeDocumentPage({
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

  const contentLength = doc.content?.length || 0;

  return (
    <DocumentDetailClient
      workspaceId={workspaceId}
      document={{
        id: doc.id,
        title: doc.title,
        metadata: { documentType: doc.documentType },
        createdAt: doc.createdAt,
        contentLength,
        isSearchable: doc.isSearchable,
        content: doc.content || '',
      }}
      objectiveId={doc.objectiveId || undefined}
      documentType="knowledge"
    />
  );
}
