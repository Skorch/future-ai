import { getLogger } from '@/lib/logger';

const logger = getLogger('ListDocuments');
import { tool } from 'ai';
import { z } from 'zod';
import { getAllObjectiveDocumentsByWorkspaceId } from '@/lib/db/objective-document';
import { getKnowledgeByWorkspaceId } from '@/lib/db/knowledge-document';
import { getAllDocumentTypes } from '@/lib/artifacts';

interface ListDocumentsProps {
  session: { user: { id: string } };
  workspaceId: string;
  domainId: string; // Domain UUID
  objectiveId: string; // Filter documents by current chat's objective
}

// Build dynamic tool description from registry
// Domain-specific - no cache (descriptions differ by domain)
async function buildToolDescription(domainId: string): Promise<string> {
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

**MANDATORY for Transcript Uploads in Discovery Mode:**
After user confirms transcript classification, ALWAYS:
1. Call listDocuments to get ALL documents
2. Filter results in your code for matching type and metadata
3. Sort by date to find 2-3 most recent related documents
4. Include these IDs in your analysis plan for user approval

**Historical Context Patterns:**
- Sales calls: Filter \`documentType === 'sales-call-summary'\` AND match \`metadata.dealName\` or \`metadata.prospectCompany\`
- Project meetings: Filter \`documentType === 'meeting-analysis'\` AND match \`metadata.projectName\`
- Client calls: Filter by client company in metadata
- Sort by date (callDate, meetingDate) descending
- Select 2-3 most recent for progression tracking

**General Usage:**
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
  objectiveId,
}: ListDocumentsProps) => {
  // Dynamically build description from registry (filtered by domain)
  const description = await buildToolDescription(domainId);

  return tool({
    description,
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
