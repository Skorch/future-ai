import { tool } from 'ai';
import { z } from 'zod';
import { getAllUserDocuments } from '@/lib/db/queries';
import type { Session } from 'next-auth';

interface ListDocumentsProps {
  session: Session;
  workspaceId: string;
}

export const listDocuments = ({ session, workspaceId }: ListDocumentsProps) =>
  tool({
    description: `List all documents available to the current user.
Returns document metadata including size information to help decide what to load.

WHEN TO USE THIS TOOL:
- ALWAYS use this before loading documents to see what's available
- When user asks about meetings/topics over a time period
- When you need to understand document sizes before loading
- To discover document types (summaries vs transcripts)

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
- 'meeting-summary': AI-generated, concise (~2-5k tokens) - ALWAYS safe to load multiple
- 'transcript': Raw meeting audio/video (~10-50k tokens) - Load selectively or partially
- 'document': Other text files - Check size before loading

PRO TIP: For time-period queries, loading ALL summaries gives more complete context
than RAG search, which might miss important topics.`,
    inputSchema: z.object({}),
    execute: async () => {
      console.log('[ListDocuments Tool] Executing list-documents tool call');
      const documents = await getAllUserDocuments({
        userId: session.user.id,
        workspaceId,
      });

      console.log('[ListDocuments Tool] Retrieved documents:', {
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

      const summary = {
        total: documents.length,
        transcripts: documents.filter((d) => d.documentType === 'transcript')
          .length,
        summaries: documents.filter((d) => d.documentType === 'meeting-summary')
          .length,
        totalSizeBytes: documents.reduce((sum, d) => sum + d.contentLength, 0),
        totalEstimatedTokens: documents.reduce(
          (sum, d) => sum + d.estimatedTokens,
          0,
        ),
      };

      if (documents.length === 0) {
        console.log('[ListDocuments Tool] No documents found for user');
        return {
          documents: [],
          summary,
          message:
            'No documents found. Documents are created when you upload transcripts or generate summaries.',
        };
      }

      console.log(
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
        console.warn(
          `[ListDocuments Tool] Removed transcript from metadata for ${transcriptsRemoved} documents`,
        );
      }

      return {
        documents: documentsWithoutPreview,
        summary,
      };
    },
  });
