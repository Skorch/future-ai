/**
 * Investigation Tools Helper
 * Builds standard set of investigation tools for artifact generation
 *
 * These tools enable the "Investigation-First Operating Philosophy" from STREAMING_AGENT_PROMPT
 * allowing AI to discover information before generating documents.
 */

import type { UIMessageStreamWriter } from 'ai';
import type { ChatMessage } from '@/lib/types';
import { listDocuments } from './list-documents';
import { loadDocument } from './load-document';
import { loadDocuments } from './load-documents';
import { queryRAG } from './query-rag';

/**
 * Build investigation tools for artifact generation
 *
 * Provides read-only investigation capabilities:
 * - listDocuments: List all documents in workspace/objective
 * - loadDocument: Load single document by ID
 * - loadDocuments: Load multiple documents efficiently
 * - queryRAG: Semantic search across knowledge base
 *
 * @param session - User session for authorization
 * @param workspaceId - Current workspace ID
 * @param objectiveId - Current objective ID
 * @param domainId - Legacy domain ID ('sales' | 'project')
 * @param dataStream - Optional UI stream for queryRAG results
 * @returns Object containing all investigation tools
 */
export async function buildInvestigationTools({
  session,
  workspaceId,
  objectiveId,
  domainId,
  dataStream,
}: {
  session: { user: { id: string } };
  workspaceId: string;
  objectiveId: string;
  domainId: 'sales' | 'project';
  dataStream?: UIMessageStreamWriter<ChatMessage>;
}) {
  return {
    // List all documents (async - returns tool instance)
    listDocuments: await listDocuments({
      session,
      workspaceId,
      domainId,
      objectiveId,
    }),

    // Load single document with optional size limit
    loadDocument: loadDocument({
      session,
      workspaceId,
    }),

    // Load multiple documents efficiently
    loadDocuments: loadDocuments({
      session,
      workspaceId,
    }),

    // Query RAG system for semantic search (conditionally include if dataStream available)
    ...(dataStream && {
      queryRAG: queryRAG({
        session,
        dataStream,
        workspaceId,
        domainId,
      }),
    }),
  };
}
