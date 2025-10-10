import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { getObjectiveById } from '@/lib/db/objective';
import { getDocumentByObjectiveId } from '@/lib/db/objective-document';
import { getChatsByObjectiveId } from '@/lib/db/queries';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PlusIcon, FileTextIcon, UploadIcon } from 'lucide-react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';

export default async function ObjectiveDetailPage(props: {
  params: Promise<{ workspaceId: string; objectiveId: string }>;
}) {
  const params = await props.params;
  const { workspaceId, objectiveId } = params;
  const { userId } = await auth();

  if (!userId) {
    redirect('/login');
  }

  // Load objective data
  const objective = await getObjectiveById(objectiveId, userId);
  if (!objective) {
    redirect(`/workspace/${workspaceId}`);
  }

  // Load document and chats in parallel
  const [document, chats] = await Promise.all([
    getDocumentByObjectiveId(objectiveId),
    getChatsByObjectiveId(objectiveId, userId),
  ]);

  return (
    <div className="container mx-auto py-6 space-y-6 max-w-6xl">
      {/* Objective Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <Link
              href={`/workspace/${workspaceId}`}
              className="text-sm text-muted-foreground hover:underline"
            >
              ← Back to Workspace
            </Link>
          </div>
          <h1 className="text-3xl font-bold mb-2">{objective.title}</h1>
          {objective.description && (
            <p className="text-muted-foreground mb-3">
              {objective.description}
            </p>
          )}
          <div className="flex items-center gap-3">
            <Badge variant="outline">{objective.documentType}</Badge>
            <Badge
              variant={
                objective.status === 'published' ? 'default' : 'secondary'
              }
            >
              {objective.status}
            </Badge>
            <span className="text-sm text-muted-foreground">
              Created{' '}
              {formatDistanceToNow(new Date(objective.createdAt), {
                addSuffix: true,
              })}
            </span>
          </div>
        </div>

        <div className="flex gap-2 flex-shrink-0">
          <Button asChild>
            <Link
              href={`/workspace/${workspaceId}/chat/new?objectiveId=${objectiveId}`}
            >
              <PlusIcon className="size-4 mr-2" />
              New Chat
            </Link>
          </Button>
          <Button variant="outline">
            <UploadIcon className="size-4 mr-2" />
            Upload
          </Button>
        </div>
      </div>

      {/* Document Viewer (if exists) */}
      {document && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileTextIcon className="h-5 w-5" />
              Document: {document.document.title}
            </CardTitle>
            {document.latestVersion && (
              <CardDescription>
                Version {document.latestVersion.versionNumber} • Last updated{' '}
                {formatDistanceToNow(
                  new Date(document.latestVersion.createdAt),
                  {
                    addSuffix: true,
                  },
                )}
              </CardDescription>
            )}
          </CardHeader>
          <CardContent>
            {document.latestVersion ? (
              <div className="prose max-w-none dark:prose-invert">
                {document.latestVersion.content}
              </div>
            ) : (
              <p className="text-muted-foreground">No document content yet</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Chat History */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Chats</h2>
          <span className="text-sm text-muted-foreground">
            {chats.length} {chats.length === 1 ? 'chat' : 'chats'}
          </span>
        </div>

        {chats.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <p className="text-muted-foreground mb-4">
                No chats yet for this objective
              </p>
              <Button asChild>
                <Link
                  href={`/workspace/${workspaceId}/chat/new?objectiveId=${objectiveId}`}
                >
                  <PlusIcon className="size-4 mr-2" />
                  Start Your First Chat
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {chats.map((chat) => (
              <Link
                key={chat.id}
                href={`/workspace/${workspaceId}/chat/${chat.id}`}
              >
                <Card className="hover:shadow-md transition-shadow cursor-pointer">
                  <CardHeader>
                    <CardTitle className="text-base">{chat.title}</CardTitle>
                    <CardDescription>
                      Created{' '}
                      {formatDistanceToNow(new Date(chat.createdAt), {
                        addSuffix: true,
                      })}{' '}
                      • {chat.visibility}
                    </CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
