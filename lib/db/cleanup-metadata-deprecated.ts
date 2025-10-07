/**
 * DEPRECATED: One-time cleanup script for old Document table
 * This script is no longer maintained as we've migrated to DocumentEnvelope/DocumentVersion schema
 *
 * Historical purpose: Removed transcript data from document metadata
 * Last used: Pre-Phase 4 migration (2025-10)
 *
 * DO NOT USE - kept for historical reference only
 */

import { getLogger } from '@/lib/logger';

const logger = getLogger('cleanup-metadata-deprecated');

export async function cleanupTranscriptsFromMetadata() {
  throw new Error(
    'DEPRECATED: This script uses the old Document table which has been removed. Use DocumentEnvelope/DocumentVersion schema instead.',
  );
}

// Prevent accidental execution
if (require.main === module) {
  logger.error('This script is deprecated and cannot be run');
  process.exit(1);
}
