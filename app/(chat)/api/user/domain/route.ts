import { auth, clerkClient } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import {
  getDomain,
  DOMAINS,
  DEFAULT_DOMAIN,
  type DomainId,
} from '@/lib/domains';
import { getLogger } from '@/lib/logger';

const logger = getLogger('DomainAPI');

export async function GET() {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    const domainId =
      (user.publicMetadata?.agentDomain as DomainId) || DEFAULT_DOMAIN;
    const domain = getDomain(domainId);

    return NextResponse.json({
      domainId: domain.id,
      label: domain.label,
      description: domain.description,
    });
  } catch (error) {
    logger.error('Failed to get user domain', error);
    return NextResponse.json(
      { error: 'Failed to get domain preference' },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { domainId } = body as { domainId?: string };

    // Validate domain ID
    if (!domainId || !DOMAINS[domainId as DomainId]) {
      return NextResponse.json({ error: 'Invalid domain ID' }, { status: 400 });
    }

    // Update user's public metadata in Clerk
    const client = await clerkClient();
    await client.users.updateUserMetadata(userId, {
      publicMetadata: {
        agentDomain: domainId,
      },
    });

    const domain = getDomain(domainId);

    return NextResponse.json({
      success: true,
      domainId: domain.id,
      label: domain.label,
      description: domain.description,
    });
  } catch (error) {
    logger.error('Failed to update user domain', error);
    return NextResponse.json(
      { error: 'Failed to update domain preference' },
      { status: 500 },
    );
  }
}
