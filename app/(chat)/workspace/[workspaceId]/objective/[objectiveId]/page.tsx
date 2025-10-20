import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { getObjectiveWithGoal } from '@/lib/db/objective';
import {
  getDocumentByObjectiveId,
  getCurrentVersionObjectiveActions,
} from '@/lib/db/objective-document';
import { getChatsByObjectiveId, db } from '@/lib/db/queries';
import { getKnowledgeByObjectiveId } from '@/lib/db/knowledge-document';
import { getByWorkspaceId as getDomainByWorkspaceId } from '@/lib/db/queries/domain';
import { artifactType } from '@/lib/db/schema';
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

  // Load objective data with goal
  const objectiveData = await getObjectiveWithGoal(objectiveId, userId);
  if (!objectiveData) {
    redirect(`/workspace/${workspaceId}`);
  }

  const { objective, objectiveGoal, goalUpdatedAt } = objectiveData;

  // Verify objective belongs to this workspace
  if (objective.workspaceId !== workspaceId) {
    redirect(`/workspace/${workspaceId}`);
  }

  // Load domain, document, chats, knowledge documents, and artifact types in parallel
  const [
    domain,
    document,
    chatsRaw,
    knowledgeDocs,
    objectiveContextArtifactType,
    objectiveDocumentArtifactType,
    objectiveActionsArtifactType,
    objectiveActionsData,
  ] = await Promise.all([
    getDomainByWorkspaceId(workspaceId),
    getDocumentByObjectiveId(objectiveId),
    getChatsByObjectiveId(objectiveId, userId),
    getKnowledgeByObjectiveId(objectiveId),
    // Fetch context artifact type labels (goal labels)
    db.query.artifactType.findFirst({
      where: eq(artifactType.id, objective.objectiveContextArtifactTypeId),
      columns: { label: true, title: true, description: true },
    }),
    // Fetch document artifact type labels
    db.query.artifactType.findFirst({
      where: eq(artifactType.id, objective.objectiveDocumentArtifactTypeId),
      columns: { label: true, title: true, description: true },
    }),
    // Fetch actions artifact type labels
    db.query.artifactType.findFirst({
      where: eq(artifactType.id, objective.objectiveActionsArtifactTypeId),
      columns: { label: true, title: true, description: true },
    }),
    // Fetch current objective actions
    getCurrentVersionObjectiveActions(objectiveId, userId),
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
      objectiveContext={objectiveGoal}
      contextUpdatedAt={goalUpdatedAt}
      objectiveContextPlaceholder={
        domain?.defaultObjectiveContextArtifactType?.description ||
        'Provide context about this objective...'
      }
      contextLabels={{
        tab: objectiveContextArtifactType?.label,
        header: objectiveContextArtifactType?.title,
        description: objectiveContextArtifactType?.description,
      }}
      documentLabels={{
        tab: objectiveDocumentArtifactType?.label,
        header: objectiveDocumentArtifactType?.title,
        description: objectiveDocumentArtifactType?.description,
      }}
      objectiveActions={objectiveActionsData?.objectiveActions ?? null}
      actionsUpdatedAt={objectiveActionsData?.updatedAt ?? null}
      actionsLabels={{
        tab: objectiveActionsArtifactType?.label || 'Action Items',
        header: objectiveActionsArtifactType?.title,
        description: objectiveActionsArtifactType?.description,
      }}
    />
  );
}
