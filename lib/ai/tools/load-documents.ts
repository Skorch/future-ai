import { getLogger } from '@/lib/logger';

const logger = getLogger('LoadDocuments');
import { tool } from 'ai';
import { z } from 'zod';
import { getDocumentsForUser } from '@/lib/db/queries';

interface LoadDocumentsProps {
  session: { user: { id: string } };
  workspaceId: string;
}

export const loadDocuments = ({ session, workspaceId }: LoadDocumentsProps) =>
  tool({
    description: `Load multiple documents into the conversation context in a single call.
Efficient for loading related documents like meeting summaries from a time period.

CRITICAL: Use list-documents FIRST to see available documents and their sizes!

WHEN TO USE THIS TOOL vs queryRAG:
- Use loadDocuments when you need COMPLETE information from specific documents
- Use loadDocuments for comprehensive analysis across time periods
- Use loadDocuments when analyzing patterns, trends, or gathering all topics
- Use queryRAG when searching for specific information or answers
- Use queryRAG when you don't know which documents contain the information

BATCH LOADING STRATEGY:
- Meeting summaries: Load all relevant ones (they're concise, usually <5k tokens each)
- Transcripts: Be selective, use maxCharsPerDoc for large ones
- Mixed types: Prioritize summaries over transcripts
- Time-based queries: Load all documents from the time period for completeness

SMART LOADING EXAMPLES:
- "Topics from last 2 weeks": Load ALL meeting summaries from that period
- "What did John say": Use queryRAG (specific search)
- "Compare this week to last week": Load all summaries from both weeks
- "Detailed review of Monday's meeting": Load that specific transcript fully

TOKEN BUDGET GUIDELINES:
- Multiple summaries: Usually safe to load 10-20 summaries (~50k tokens total)
- Multiple transcripts: Limit to 3-5 with maxCharsPerDoc=20000
- Context limit: ~100k tokens total for entire conversation

The tool returns an array of loaded documents with their content and metadata.`,
    inputSchema: z.object({
      documentIds: z
        .array(z.string().uuid())
        .min(1)
        .max(50)
        .describe('Array of document IDs to load (from list-documents)'),
      maxCharsPerDoc: z
        .number()
        .optional()
        .describe(
          'Maximum characters to load per document. Omit to load full documents. Useful for loading multiple large transcripts.',
        ),
    }),
    execute: async ({ documentIds, maxCharsPerDoc }) => {
      const documents = await getDocumentsForUser({
        documentIds,
        userId: session.user.id,
        workspaceId,
        maxCharsPerDoc,
      });

      if (documents.length === 0) {
        return {
          error: 'NO_DOCUMENTS_FOUND',
          message: 'No documents found or you do not have access',
          requestedIds: documentIds,
          suggestion: 'Use list-documents to see available documents',
        };
      }

      // Calculate total tokens loaded
      const totalCharsLoaded = documents.reduce(
        (sum, doc) => sum + doc.loadedChars,
        0,
      );
      const totalCharsAvailable = documents.reduce(
        (sum, doc) => sum + doc.fullContentLength,
        0,
      );
      const estimatedTokensLoaded = Math.ceil(totalCharsLoaded / 4);
      const estimatedTokensTotal = Math.ceil(totalCharsAvailable / 4);

      // Group by document type for summary
      const summaryCount = documents.filter(
        (d) => d.documentType === 'meeting-summary',
      ).length;
      const transcriptCount = documents.filter(
        (d) => d.documentType === 'transcript',
      ).length;
      const otherCount = documents.filter(
        (d) => d.documentType === 'document',
      ).length;

      const loadMessage = maxCharsPerDoc
        ? `Loaded ${documents.length} documents (${summaryCount} summaries, ${transcriptCount} transcripts${
            otherCount ? `, ${otherCount} other` : ''
          }) with ${maxCharsPerDoc.toLocaleString()} chars limit per document. Total: ${totalCharsLoaded.toLocaleString()} of ${totalCharsAvailable.toLocaleString()} characters (~${estimatedTokensLoaded.toLocaleString()} tokens)`
        : `Loaded ${documents.length} complete documents (${summaryCount} summaries, ${transcriptCount} transcripts${
            otherCount ? `, ${otherCount} other` : ''
          }). Total: ${totalCharsLoaded.toLocaleString()} characters (~${estimatedTokensLoaded.toLocaleString()} tokens)`;

      logger.info('[LoadDocuments Tool] Documents loaded successfully:', {
        count: documents.length,
        summaries: summaryCount,
        transcripts: transcriptCount,
        totalCharsLoaded,
        totalCharsAvailable,
        estimatedTokensLoaded,
        percentLoaded: Math.round(
          (totalCharsLoaded / totalCharsAvailable) * 100,
        ),
      });

      return {
        documents: documents.map((doc) => {
          // Clean metadata by removing transcript if it exists
          let cleanedMetadata = doc.metadata;
          if (
            doc.metadata &&
            typeof doc.metadata === 'object' &&
            'transcript' in doc.metadata
          ) {
            const { transcript, ...rest } = doc.metadata as Record<
              string,
              unknown
            > & { transcript?: unknown };
            cleanedMetadata = rest;
            logger.warn(
              `[LoadDocuments Tool] Removed transcript from metadata for document: ${doc.id}`,
            );
          }

          return {
            id: doc.id,
            title: doc.title,
            content: doc.content,
            metadata: cleanedMetadata,
            sourceDocumentIds: doc.sourceDocumentIds,
            createdAt: doc.createdAt,
            documentType: doc.documentType,
            loadInfo: {
              truncated: doc.truncated,
              loadedChars: doc.loadedChars,
              fullContentLength: doc.fullContentLength,
              estimatedTokensLoaded: Math.ceil(doc.loadedChars / 4),
              estimatedTokensTotal: Math.ceil(doc.fullContentLength / 4),
            },
          };
        }),
        summary: {
          documentsLoaded: documents.length,
          documentsRequested: documentIds.length,
          documentsMissing: documentIds.length - documents.length,
          byType: {
            summaries: summaryCount,
            transcripts: transcriptCount,
            other: otherCount,
          },
          totalCharsLoaded,
          totalCharsAvailable,
          estimatedTokensLoaded,
          estimatedTokensTotal,
          percentLoaded: Math.round(
            (totalCharsLoaded / totalCharsAvailable) * 100,
          ),
        },
        loadMessage,
      };
    },
  });
