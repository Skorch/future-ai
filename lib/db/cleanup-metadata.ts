import { getLogger } from '@/lib/logger';

const logger = getLogger('cleanup-metadata'); /**
 * One-time cleanup script to remove transcript data from document metadata
 * Run this to fix existing documents that have transcripts stored in metadata
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { document } from './schema';
import { eq } from 'drizzle-orm';

export async function cleanupTranscriptsFromMetadata() {
  // biome-ignore lint: Forbidden non-null assertion.
  const client = postgres(process.env.POSTGRES_URL!);
  const db = drizzle(client);

  try {
    logger.info('[Cleanup] Starting metadata cleanup...');

    // Get all documents
    const documents = await db
      .select({
        id: document.id,
        title: document.title,
        metadata: document.metadata,
      })
      .from(document);

    logger.info(`[Cleanup] Found ${documents.length} documents to check`);

    let cleanedCount = 0;

    for (const doc of documents) {
      if (doc.metadata && typeof doc.metadata === 'object') {
        const metadata = doc.metadata as Record<string, unknown> & {
          transcript?: unknown;
        };

        // Check if transcript exists in metadata
        if (metadata.transcript) {
          const transcriptSize =
            typeof metadata.transcript === 'string'
              ? metadata.transcript.length
              : JSON.stringify(metadata.transcript).length;

          logger.info(
            `[Cleanup] Document "${doc.title}" has transcript in metadata (${transcriptSize} chars)`,
          );

          // Remove transcript from metadata
          const { transcript, ...cleanMetadata } = metadata;

          // Update the document
          await db
            .update(document)
            .set({ metadata: cleanMetadata })
            .where(eq(document.id, doc.id));

          cleanedCount++;
          logger.info(`[Cleanup] Cleaned metadata for document: ${doc.title}`);
        }
      }
    }

    logger.info(`[Cleanup] Completed! Cleaned ${cleanedCount} documents`);
    return {
      totalDocuments: documents.length,
      cleanedDocuments: cleanedCount,
    };
  } catch (error) {
    logger.error('[Cleanup] Error cleaning metadata:', error);
    throw error;
  }
}

// Run this function once to clean existing documents
// You can call it from a route handler or run it as a script
if (require.main === module) {
  cleanupTranscriptsFromMetadata()
    .then((result) => {
      logger.info('Cleanup completed:', result);
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Cleanup failed:', error);
      process.exit(1);
    });
}
