import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { getWorkspaceById } from '@/lib/workspace/queries';
import { getObjectivesByWorkspaceId } from '@/lib/db/objective';
import { getKnowledgeByWorkspaceId } from '@/lib/db/knowledge-document';
import { getByWorkspaceId as getDomainByWorkspaceId } from '@/lib/db/queries/domain';
import { WorkspacePageClient } from '@/components/workspace/workspace-page-client';

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
  const [objectives, knowledge, raw, domain] = await Promise.all([
    getObjectivesByWorkspaceId(workspaceId, true), // Include both 'open' and 'published' objectives
    getKnowledgeByWorkspaceId(workspaceId, 'knowledge'),
    getKnowledgeByWorkspaceId(workspaceId, 'raw'),
    getDomainByWorkspaceId(workspaceId),
  ]);

  // Get workspace context placeholder from domain's workspace context artifact type
  const workspaceContextPlaceholder =
    domain?.defaultWorkspaceContextArtifactType?.description ||
    'Provide context about this workspace...';

  return (
    <WorkspacePageClient
      workspace={workspace}
      objectives={objectives}
      knowledge={knowledge}
      raw={raw}
      workspaceContextPlaceholder={workspaceContextPlaceholder}
    />
  );
}
