import { getLogger } from '@/lib/logger';

const logger = getLogger('ListDocuments');
import { tool } from 'ai';
import { z } from 'zod';
import { getAllObjectiveDocumentsByWorkspaceId } from '@/lib/db/objective-document';
import { getKnowledgeByWorkspaceId } from '@/lib/db/knowledge-document';

interface ListDocumentsProps {
  session: { user: { id: string } };
  workspaceId: string;
  domainId: string; // Domain UUID
  objectiveId: string; // Filter documents by current chat's objective
}

export const listDocuments = async ({
  session,
  workspaceId,
  domainId,
  objectiveId,
}: ListDocumentsProps) => {
  return tool({
    description:
      'List available knowledge documents. Use this to discover what knowledge has been captured that could inform your work.',
    inputSchema: z.object({}),
    execute: async () => {
      logger.debug('[ListDocuments Tool] Executing list-documents tool call', {
        objectiveId,
        workspaceId,
      });

      // Query both ObjectiveDocuments and KnowledgeDocuments
      // Filter by current objective to prevent cross-objective contamination
      const [objectiveDocs, knowledgeDocs] = await Promise.all([
        getAllObjectiveDocumentsByWorkspaceId(
          workspaceId,
          session.user.id,
          objectiveId,
        ),
        getKnowledgeByWorkspaceId(workspaceId, undefined, objectiveId),
      ]);

      // Transform ObjectiveDocuments to common format
      const objectiveDocsTransformed = objectiveDocs.map((item) => ({
        id: item.document.id,
        title: item.document.title,
        documentType:
          (item.latestVersion?.metadata?.documentType as string) || 'text',
        createdAt: item.document.createdAt,
        metadata: (item.latestVersion?.metadata || {}) as Record<
          string,
          unknown
        >,
        contentLength: item.latestVersion?.content?.length || 0,
        source: 'objective' as const,
      }));

      // Transform KnowledgeDocuments to common format
      const knowledgeDocsTransformed = knowledgeDocs.map((doc) => ({
        id: doc.id,
        title: doc.title,
        documentType: doc.documentType as string,
        createdAt: doc.createdAt,
        metadata: (doc.metadata || {}) as Record<string, unknown>,
        contentLength: doc.content?.length || 0,
        source: 'knowledge' as const,
      }));

      // Merge both document types
      const documents = [
        ...objectiveDocsTransformed,
        ...knowledgeDocsTransformed,
      ];

      // Generate counts for all document types dynamically
      const typeCounts = Object.create(null) as Record<string, number>;
      for (const doc of documents) {
        const type = doc.documentType || 'unknown';
        typeCounts[type] = (typeCounts[type] || 0) + 1;
      }

      logger.debug('[ListDocuments Tool] Retrieved documents:', {
        count: documents.length,
        objectiveCount: objectiveDocsTransformed.length,
        knowledgeCount: knowledgeDocsTransformed.length,
        types: typeCounts,
      });

      const summary = {
        total: documents.length,
        byType: typeCounts,
        // PHASE 4 REFACTORING: Size metrics will be restored with new document structure
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

      // PHASE 4 REFACTORING: Return stub documents - metadata handling will be updated
      return {
        documents,
        summary,
      };
    },
  });
};
