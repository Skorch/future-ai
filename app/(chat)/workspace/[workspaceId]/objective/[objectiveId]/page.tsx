import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { getObjectiveWithContext } from '@/lib/db/objective';
import { getDocumentByObjectiveId } from '@/lib/db/objective-document';
import { getChatsByObjectiveId } from '@/lib/db/queries';
import { getKnowledgeByObjectiveId } from '@/lib/db/knowledge-document';
import { getWorkspaceById } from '@/lib/workspace/queries';
import { getDomain } from '@/lib/domains';
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

  // Load objective data with context
  const objectiveData = await getObjectiveWithContext(objectiveId, userId);
  if (!objectiveData) {
    redirect(`/workspace/${workspaceId}`);
  }

  const { objective, context, contextUpdatedAt } = objectiveData;

  // Verify objective belongs to this workspace
  if (objective.workspaceId !== workspaceId) {
    redirect(`/workspace/${workspaceId}`);
  }

  // Get domain for placeholder
  const workspace = await getWorkspaceById(workspaceId, userId);
  const domain = getDomain(workspace?.domainId);

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
      objectiveContext={context}
      contextUpdatedAt={contextUpdatedAt}
      objectiveContextPlaceholder={domain.objectiveContextPlaceholder}
    />
  );
}
