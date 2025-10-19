import { db } from '@/lib/db/queries';
import { domain } from '@/lib/db/schema';
import { getLogger } from '@/lib/logger';

const logger = getLogger('DomainsAPI');

export async function GET() {
  try {
    const domains = await db.select().from(domain).orderBy(domain.title);
    return Response.json(domains);
  } catch (error) {
    logger.error('Failed to fetch domains:', error);
    return Response.json({ error: 'Failed to fetch domains' }, { status: 500 });
  }
}
