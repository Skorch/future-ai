import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { getObjectiveById } from '@/lib/db/objective';
import { getDocumentByObjectiveId } from '@/lib/db/objective-document';
import { getChatsByObjectiveId } from '@/lib/db/queries';
import { ObjectiveDetailClient } from './objective-detail-client';

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

  // Verify objective belongs to this workspace
  if (objective.workspaceId !== workspaceId) {
    redirect(`/workspace/${workspaceId}`);
  }

  // Load document and chats in parallel
  const [document, chatsRaw] = await Promise.all([
    getDocumentByObjectiveId(objectiveId),
    getChatsByObjectiveId(objectiveId, userId),
  ]);

  // Array safety - ensure we always have an array
  const chats = (chatsRaw ?? []).map((chat) => ({
    id: chat.id,
    title: chat.title,
    createdAt: chat.createdAt,
    messageCount: chat.messageCount || 0,
    visibility: chat.visibility,
  }));

  return (
    <ObjectiveDetailClient
      workspaceId={workspaceId}
      objectiveId={objectiveId}
      objective={objective}
      document={document}
      chats={chats}
    />
  );
}
