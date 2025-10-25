import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getByWorkspaceId as getDomainByWorkspaceId } from '@/lib/db/queries/domain';
import { getPlaybooksForDomain } from '@/lib/db/queries/playbooks';
import { getLogger } from '@/lib/logger';

const logger = getLogger('PlaybooksAPI');

export async function GET(
  request: Request,
  props: { params: Promise<{ workspaceId: string }> },
) {
  const params = await props.params;
  const { workspaceId } = params;

  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get domain for workspace
    const domain = await getDomainByWorkspaceId(workspaceId);

    if (!domain) {
      logger.warn(`Domain not found for workspace: ${workspaceId}`);
      return NextResponse.json(
        { playbooks: [] },
        { status: 200 }, // Return empty array, not an error
      );
    }

    // Get playbooks for domain
    const playbooks = await getPlaybooksForDomain(domain.id);

    logger.debug(
      `Fetched ${playbooks.length} playbooks for workspace ${workspaceId}`,
    );

    return NextResponse.json({ playbooks });
  } catch (error) {
    logger.error('Error fetching playbooks:', error);
    return NextResponse.json(
      { error: 'Failed to fetch playbooks', playbooks: [] },
      { status: 500 },
    );
  }
}
