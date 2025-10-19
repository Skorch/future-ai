import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { getWorkspaceById } from '@/lib/workspace/queries';
import { getObjectivesByWorkspaceId } from '@/lib/db/objective';
import { getKnowledgeByWorkspaceId } from '@/lib/db/knowledge-document';
import { getByWorkspaceId as getDomainByWorkspaceId } from '@/lib/db/queries/domain';
import { WorkspacePageClient } from '@/components/workspace/workspace-page-client';
import { db } from '@/lib/db/queries';
import { artifactType } from '@/lib/db/schema';

export default async function WorkspacePage(props: {
  params: Promise<{ workspaceId: string }>;
}) {
  const params = await props.params;
  const { workspaceId } = params;
  const { userId } = await auth();

  if (!userId) {
    redirect('/login');
  }

  // Verify workspace ownership
  const workspace = await getWorkspaceById(workspaceId, userId);
  if (!workspace) {
    redirect('/');
  }

  // Fetch all data in parallel
  const [objectives, knowledge, raw, domain, workspaceContextArtifactType] =
    await Promise.all([
      getObjectivesByWorkspaceId(workspaceId, true), // Include both 'open' and 'published' objectives
      getKnowledgeByWorkspaceId(workspaceId, 'knowledge'),
      getKnowledgeByWorkspaceId(workspaceId, 'raw'),
      getDomainByWorkspaceId(workspaceId),
      // Fetch workspace context artifact type for labels
      workspace.workspaceContextArtifactTypeId
        ? db.query.artifactType.findFirst({
            where: eq(
              artifactType.id,
              workspace.workspaceContextArtifactTypeId,
            ),
            columns: { label: true, title: true, description: true },
          })
        : null,
    ]);

  // Get workspace context placeholder from artifact type description
  const workspaceContextPlaceholder =
    workspaceContextArtifactType?.description ||
    domain?.defaultWorkspaceContextArtifactType?.description ||
    'Provide context about this workspace...';

  return (
    <WorkspacePageClient
      workspace={workspace}
      objectives={objectives}
      knowledge={knowledge}
      raw={raw}
      workspaceContextPlaceholder={workspaceContextPlaceholder}
      contextLabels={{
        tab: workspaceContextArtifactType?.label,
        header: workspaceContextArtifactType?.title,
        description: workspaceContextArtifactType?.description,
      }}
    />
  );
}
