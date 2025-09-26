import { Webhook } from 'svix';
import { headers } from 'next/headers';
import type { WebhookEvent } from '@clerk/nextjs/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/queries';
import { user as userTable } from '@/lib/db/schema';
import { upsertUser } from '@/lib/db/queries';
import { createWorkspace } from '@/lib/workspace/queries';

export async function POST(req: Request) {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

  if (!WEBHOOK_SECRET) {
    console.error('CLERK_WEBHOOK_SECRET not set');
    return new Response('Error: Webhook secret not configured', {
      status: 500,
    });
  }

  // Get headers for verification
  const headerPayload = await headers();
  const svix_id = headerPayload.get('svix-id');
  const svix_timestamp = headerPayload.get('svix-timestamp');
  const svix_signature = headerPayload.get('svix-signature');

  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response('Error: Missing svix headers', { status: 400 });
  }

  const payload = await req.json();
  const body = JSON.stringify(payload);

  // Verify webhook authenticity
  const wh = new Webhook(WEBHOOK_SECRET);
  let evt: WebhookEvent;

  try {
    evt = wh.verify(body, {
      'svix-id': svix_id,
      'svix-timestamp': svix_timestamp,
      'svix-signature': svix_signature,
    }) as WebhookEvent;
  } catch (err) {
    console.error('Error verifying webhook:', err);
    return new Response('Error: Invalid signature', { status: 400 });
  }

  const eventType = evt.type;

  switch (eventType) {
    case 'user.created': {
      const {
        id,
        first_name,
        last_name,
        email_addresses,
        image_url,
        created_at,
      } = evt.data;

      try {
        // Upsert user in database (idempotent in case of webhook replay)
        await upsertUser({
          id: id, // Use Clerk ID directly as primary key
          email: email_addresses[0]?.email_address || '',
          firstName: first_name || null,
          lastName: last_name || null,
          imageUrl: image_url || null,
          emailVerified:
            email_addresses[0]?.verification?.status === 'verified',
          createdAt: new Date(created_at),
          updatedAt: new Date(created_at),
        });

        // Create default workspace for new user
        await createWorkspace(
          id,
          'Personal Workspace', // Using "Personal" as requested, not first name
          'Your personal workspace',
        );
      } catch (error) {
        console.error('Error processing user.created webhook:', error);
        return new Response('Error processing webhook', { status: 500 });
      }
      break;
    }

    case 'user.updated': {
      const updatedUser = evt.data;
      try {
        await upsertUser({
          id: updatedUser.id,
          email: updatedUser.email_addresses[0]?.email_address || '',
          firstName: updatedUser.first_name || null,
          lastName: updatedUser.last_name || null,
          imageUrl: updatedUser.image_url || null,
          emailVerified:
            updatedUser.email_addresses[0]?.verification?.status === 'verified',
          updatedAt: new Date(),
        });
      } catch (error) {
        console.error('Error processing user.updated webhook:', error);
        return new Response('Error processing webhook', { status: 500 });
      }
      break;
    }

    case 'user.deleted':
      try {
        // User deletion will cascade to workspaces
        const deletedUserId = evt.data.id;
        if (deletedUserId) {
          await db.delete(userTable).where(eq(userTable.id, deletedUserId));
        }
      } catch (error) {
        console.error('Error processing user.deleted webhook:', error);
        return new Response('Error processing webhook', { status: 500 });
      }
      break;

    default:
      console.log(`Unhandled webhook event: ${eventType}`);
  }

  return new Response('Webhook processed', { status: 200 });
}
