import { auth } from '@/app/(auth)/auth';
import { deleteAllUserData } from '@/lib/db/queries';
import { NextResponse } from 'next/server';
import { PineconeClient } from '@/lib/rag/pinecone-client';

export async function DELETE() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;

    // Delete all user data from database using DAL
    await deleteAllUserData(userId);

    // 8. Delete the RAG index for this user
    try {
      const pineconeClient = new PineconeClient();
      // Delete the entire namespace for this user
      await pineconeClient.deleteNamespace(userId);
      console.log(`[Reset] Deleted RAG namespace for user ${userId}`);
    } catch (error) {
      console.error('[Reset] Failed to delete RAG index:', error);
      // Continue even if RAG deletion fails
    }

    return NextResponse.json({
      success: true,
      message: 'All user data has been deleted successfully',
    });
  } catch (error) {
    console.error('[Reset] Error deleting user data:', error);
    return NextResponse.json(
      { error: 'Failed to delete user data' },
      { status: 500 },
    );
  }
}
