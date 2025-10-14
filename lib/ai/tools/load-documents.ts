import { getLogger } from '@/lib/logger';

const logger = getLogger('LoadDocuments');
import { tool } from 'ai';
import { z } from 'zod';
import { getKnowledgeDocumentById } from '@/lib/db/knowledge-document';
import { getObjectiveDocumentById } from '@/lib/db/objective-document';

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
      // Batch load documents (try both types for each ID)
      const loadResults = await Promise.all(
        documentIds.map(async (id) => {
          // Try KnowledgeDocument first
          const knowledgeDoc = await getKnowledgeDocumentById(id);
          if (knowledgeDoc) {
            return {
              id: knowledgeDoc.id,
              title: knowledgeDoc.title,
              content: knowledgeDoc.content,
              documentType: knowledgeDoc.documentType,
              createdAt: knowledgeDoc.createdAt,
              metadata: knowledgeDoc.metadata,
            };
          }

          // Try ObjectiveDocument
          const objectiveDoc = await getObjectiveDocumentById(id);
          if (objectiveDoc?.latestVersion) {
            // Type metadata properly to avoid `any`
            const metadata = objectiveDoc.latestVersion.metadata as Record<
              string,
              unknown
            > | null;
            const documentType =
              typeof metadata?.documentType === 'string'
                ? metadata.documentType
                : 'text';

            return {
              id: objectiveDoc.document.id,
              title: objectiveDoc.document.title,
              content: objectiveDoc.latestVersion.content,
              documentType,
              createdAt: objectiveDoc.latestVersion.createdAt,
              metadata: objectiveDoc.latestVersion.metadata,
            };
          }

          return null;
        }),
      );

      const rawDocuments = loadResults.filter((doc) => doc !== null);

      if (rawDocuments.length === 0) {
        return {
          error: 'NO_DOCUMENTS_FOUND',
          message: 'No documents found or you do not have access',
          requestedIds: documentIds,
          suggestion: 'Use list-documents to see available documents',
        };
      }

      const documents = rawDocuments.map((doc) => {
        const docContent = doc.content || '';
        const truncated = maxCharsPerDoc && docContent.length > maxCharsPerDoc;
        return {
          ...doc,
          content: truncated ? docContent.slice(0, maxCharsPerDoc) : docContent,
          truncated,
          loadedChars: truncated ? maxCharsPerDoc : docContent.length,
          fullContentLength: docContent.length,
        };
      });

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

      // Group by document type for summary - dynamic counts
      const typeCounts = documents.reduce(
        (acc, doc) => {
          const type = doc.documentType || 'unknown';
          acc[type] = (acc[type] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      );

      // Build type summary string
      const typeEntries = Object.entries(typeCounts);
      const typesSummary = typeEntries
        .map(([type, count]) => `${count} ${type}`)
        .join(', ');

      const loadMessage = maxCharsPerDoc
        ? `Loaded ${documents.length} documents (${typesSummary}) with ${maxCharsPerDoc.toLocaleString()} chars limit per document. Total: ${totalCharsLoaded.toLocaleString()} of ${totalCharsAvailable.toLocaleString()} characters (~${estimatedTokensLoaded.toLocaleString()} tokens)`
        : `Loaded ${documents.length} complete documents (${typesSummary}). Total: ${totalCharsLoaded.toLocaleString()} characters (~${estimatedTokensLoaded.toLocaleString()} tokens)`;

      logger.debug('[LoadDocuments Tool] Documents loaded successfully:', {
        count: documents.length,
        byType: typeCounts,
        totalCharsLoaded,
        totalCharsAvailable,
        estimatedTokensLoaded,
        percentLoaded: Math.round(
          (totalCharsLoaded / totalCharsAvailable) * 100,
        ),
      });

      return {
        documents: documents.map((doc) => {
          // Clean metadata by removing transcript if it exists - DEPRECATED CODE
          // @ts-ignore - Phase 2 schema changes
          let cleanedMetadata = doc.metadata;
          if (
            // @ts-ignore - Phase 2 schema changes
            doc.metadata &&
            // @ts-ignore - Phase 2 schema changes
            typeof doc.metadata === 'object' &&
            // @ts-ignore - Phase 2 schema changes
            'transcript' in doc.metadata
          ) {
            // @ts-ignore - Phase 2 schema changes
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
            // @ts-ignore - Phase 2 schema changes
            content: doc.content,
            metadata: cleanedMetadata,
            // @ts-ignore - Phase 2 schema changes
            createdAt: doc.createdAt,
            // @ts-ignore - Phase 2 schema changes
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
          byType: typeCounts,
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
