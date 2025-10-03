import { getLogger } from '@/lib/logger';

const logger = getLogger('ListDocuments');
import { tool } from 'ai';
import { z } from 'zod';
import { getAllUserDocuments } from '@/lib/db/documents';
import { getAllDocumentTypes } from '@/lib/artifacts';
import type { DomainId } from '@/lib/domains';

interface ListDocumentsProps {
  session: { user: { id: string } };
  workspaceId: string;
  domainId: DomainId;
}

// Build dynamic tool description from registry
// Domain-specific - no cache (descriptions differ by domain)
async function buildToolDescription(domainId: DomainId): Promise<string> {
  try {
    const docTypes = await getAllDocumentTypes(domainId);

    // Build dynamic type descriptions from registry
    const typeDescriptions = docTypes
      .map((dt) => {
        return `- '${dt.metadata.type}': ${dt.metadata.description}`;
      })
      .join('\n');

    // Add transcript manually since it's not in registry (upload-only)
    const allTypes = `${typeDescriptions}\n- 'transcript': Raw meeting audio/video - Load selectively or partially`;

    return `List all documents available to the current user.
Returns document metadata including size information to help decide what to load.

WHEN TO USE THIS TOOL:
- ALWAYS use this FIRST when you need to discover what documents exist
- When user asks about topics over time (list all, then load relevant ones)
- Before using queryRAG to search content (know what's available first)
- To get document metadata (IDs, types, dates, titles) for tool calls
- When you need document IDs for createDocument parameters

DECISION FLOW FOR COMMON QUERIES:
1. "Topics from meetings in [time period]":
   → list-documents → load all meeting-summaries from that period

2. "What was discussed about [specific topic]":
   → queryRAG first (it searches content)
   → If insufficient: list-documents → load relevant documents

3. "Summary of all meetings":
   → list-documents → load all meeting-summaries (they're concise)

4. "Details from [specific meeting]":
   → list-documents → load that specific document fully

DOCUMENT TYPES & LOADING STRATEGY:
${allTypes}

PRO TIP: For time-period queries, loading ALL document summaries gives more complete context
than RAG search, which might miss important topics. Check document size before loading.`;
  } catch (error) {
    logger.warn('Failed to load document types for tool description', error);
    // Fallback description
    return `List all documents available to the current user.
Returns document metadata including size information to help decide what to load.

Use this tool to discover available documents before loading them.`;
  }
}

export const listDocuments = async ({
  session,
  workspaceId,
  domainId,
}: ListDocumentsProps) => {
  // Dynamically build description from registry (filtered by domain)
  const description = await buildToolDescription(domainId);

  return tool({
    description,
    inputSchema: z.object({}),
    execute: async () => {
      logger.debug('[ListDocuments Tool] Executing list-documents tool call');
      const documents = await getAllUserDocuments({
        userId: session.user.id,
        workspaceId,
      });

      logger.debug('[ListDocuments Tool] Retrieved documents:', {
        count: documents.length,
        types: documents.reduce(
          (acc, d) => {
            acc[d.documentType] = (acc[d.documentType] || 0) + 1;
            return acc;
          },
          {} as Record<string, number>,
        ),
        totalSize: documents.reduce((sum, d) => sum + d.contentLength, 0),
        totalTokens: documents.reduce((sum, d) => sum + d.estimatedTokens, 0),
      });

      // Generate counts for all document types dynamically
      const typeCounts = documents.reduce(
        (acc, doc) => {
          const type = doc.documentType || 'unknown';
          acc[type] = (acc[type] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      );

      const summary = {
        total: documents.length,
        byType: typeCounts,
        totalSizeBytes: documents.reduce((sum, d) => sum + d.contentLength, 0),
        totalEstimatedTokens: documents.reduce(
          (sum, d) => sum + d.estimatedTokens,
          0,
        ),
      };

      if (documents.length === 0) {
        return {
          documents: [],
          summary,
          message:
            'No documents found. Documents are created when you upload transcripts or generate summaries.',
        };
      }

      logger.debug(
        '[ListDocuments Tool] Returning',
        documents.length,
        'documents with summary',
      );

      // Remove contentPreview and clean up metadata
      let transcriptsRemoved = 0;
      const documentsWithoutPreview = documents.map(
        ({ contentPreview, metadata, ...doc }) => {
          // Clean up metadata by removing transcript if it exists
          if (
            metadata &&
            typeof metadata === 'object' &&
            'transcript' in metadata
          ) {
            const { transcript, ...cleanMetadata } = metadata as Record<
              string,
              unknown
            > & { transcript?: unknown };
            if (transcript) {
              transcriptsRemoved++;
            }
            return {
              ...doc,
              metadata: cleanMetadata,
            };
          }
          return {
            ...doc,
            metadata,
          };
        },
      );

      // Only log if we actually removed transcripts
      if (transcriptsRemoved > 0) {
        logger.warn(
          `[ListDocuments Tool] Removed transcript from metadata for ${transcriptsRemoved} documents`,
        );
      }

      return {
        documents: documentsWithoutPreview,
        summary,
      };
    },
  });
};
