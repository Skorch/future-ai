'use server';

import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import {
  getCurrentVersionObjectiveActions,
  updateVersionObjectiveActions,
} from '@/lib/db/objective-document';
import { ChatSDKError } from '@/lib/errors';

export async function updateObjectiveActionsAction(
  objectiveId: string,
  objectiveActions: string,
): Promise<undefined | { error: string }> {
  try {
    const { userId } = await auth();
    if (!userId) {
      redirect('/login');
    }

    // Get current version to update
    const versionData = await getCurrentVersionObjectiveActions(
      objectiveId,
      userId,
    );

    if (!versionData) {
      return { error: 'Version not found' };
    }

    // Update the version's objectiveActions field
    await updateVersionObjectiveActions(
      versionData.versionId,
      objectiveActions,
    );

    return undefined;
  } catch (error) {
    if (error instanceof ChatSDKError) {
      return { error: error.message };
    }
    throw error;
  }
}
