import { auth } from '@clerk/nextjs/server';
import { redirect, notFound } from 'next/navigation';
import { getDocumentsById } from '@/lib/db/documents';
import { DocumentHeader } from '@/components/document-header';
import { DocumentViewer } from '@/components/document-viewer';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

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
    <div className="container mx-auto py-6">
      <div className="mb-4">
        <Button asChild variant="ghost">
          <Link href={`/workspace/${workspaceId}/document`}>
            ← Back to Documents
          </Link>
        </Button>
      </div>

      <DocumentHeader
        document={{
          id: document.id,
          title: document.title,
          metadata: document.metadata as { documentType?: string },
          createdAt: document.createdAt,
          contentLength,
        }}
      />

      <div className="border rounded-lg bg-card">
        <DocumentViewer content={document.content || ''} />
      </div>
    </div>
  );
}
