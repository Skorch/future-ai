import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { getObjectiveById } from '@/lib/db/objective';
import { getDocumentByObjectiveId } from '@/lib/db/objective-document';
import { getChatsByObjectiveId } from '@/lib/db/queries';
import { getKnowledgeByObjectiveId } from '@/lib/db/knowledge-document';
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

  // Load document, chats, and knowledge documents in parallel
  const [document, chatsRaw, knowledgeDocs] = await Promise.all([
    getDocumentByObjectiveId(objectiveId),
    getChatsByObjectiveId(objectiveId, userId),
    getKnowledgeByObjectiveId(objectiveId),
  ]);

  // Array safety - ensure we always have an array
  const chats = (chatsRaw ?? []).map((chat) => ({
    id: chat.id,
    title: chat.title,
    createdAt: chat.createdAt,
    messageCount: chat.messageCount || 0,
  }));

  // Filter knowledge documents by category
  const knowledge = (knowledgeDocs ?? []).filter(
    (doc) => doc.category === 'knowledge',
  );
  const raw = (knowledgeDocs ?? []).filter((doc) => doc.category === 'raw');

  return (
    <ObjectiveDetailClient
      workspaceId={workspaceId}
      objectiveId={objectiveId}
      objective={objective}
      document={document}
      chats={chats}
      knowledge={knowledge}
      raw={raw}
    />
  );
}
