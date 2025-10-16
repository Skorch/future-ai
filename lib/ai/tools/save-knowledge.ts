import 'server-only';

import { tool } from 'ai';
import { z } from 'zod';
import {
  createKnowledgeDocument,
  getKnowledgeDocumentById,
} from '@/lib/db/knowledge-document';
import { getObjectiveById } from '@/lib/db/objective';
import type { UIMessageStreamWriter } from 'ai';
import type { ChatMessage } from '@/lib/types';
import { getLogger } from '@/lib/logger';
import type { KnowledgeHandler } from '@/lib/artifacts/knowledge-types/base-handler';

const logger = getLogger('SaveKnowledge');

// Participant schema for validation
const ParticipantSchema = z.object({
  email: z.string().email().optional(),
  displayName: z.string().min(1),
});

interface SaveKnowledgeProps {
  session: { user: { id: string } };
  dataStream: UIMessageStreamWriter<ChatMessage>;
  workspaceId: string;
  objectiveId: string;
}

export const saveKnowledge = ({
  session,
  dataStream,
  workspaceId,
  objectiveId,
}: SaveKnowledgeProps) =>
  tool({
    description: `Generate and save a knowledge summary from raw content.

This tool:
1. Loads the raw content from the specified knowledge document
2. Generates a filtered summary focused on the current objective
3. Streams the summary to the UI as it's generated
4. Saves the summary as a new knowledge document

IMPORTANT:
- The summary generation happens inside this tool (not before calling it)
- The tool will stream the summary to the user for review
- After generation, the user can edit the summary in the UI (auto-saves)
- Use this tool as directed by playbook steps`,

    inputSchema: z.object({
      rawKnowledgeDocumentId: z
        .string()
        .uuid()
        .describe('ID of the raw knowledge document to summarize'),
      documentType: z
        .enum(['sales-call-summary', 'requirements-meeting-summary'])
        .describe('Type of summary to generate'),
      instruction: z
        .string()
        .optional()
        .describe('Additional instructions for summary generation'),

      // Metadata fields
      sourceType: z
        .enum(['transcript', 'email', 'slack', 'note'])
        .describe('Type of source material'),
      sourceDate: z
        .string()
        .datetime()
        .describe('ISO 8601 date when source content was created'),
      participants: z
        .array(ParticipantSchema)
        .min(1)
        .describe('All participants/attendees (must include at least one)'),
    }),

    execute: async (params) => {
      logger.debug('Generating knowledge summary', {
        rawDocId: params.rawKnowledgeDocumentId,
        type: params.documentType,
        objectiveId,
      });

      try {
        // 1. Load raw content
        const rawDoc = await getKnowledgeDocumentById(
          params.rawKnowledgeDocumentId,
        );

        if (!rawDoc) {
          throw new Error('Raw knowledge document not found');
        }

        // 2. Load objective for topic filtering context
        const objective = await getObjectiveById(objectiveId, session.user.id);

        if (!objective) {
          throw new Error('Objective not found or access denied');
        }

        // 2.5. Load workspace for domain context
        const { db } = await import('@/lib/db/queries');
        const { workspace: workspaceSchema } = await import('@/lib/db/schema');
        const { eq } = await import('drizzle-orm');
        const { getDomain } = await import('@/lib/domains');

        const workspaceData = await db
          .select()
          .from(workspaceSchema)
          .where(eq(workspaceSchema.id, workspaceId))
          .limit(1);

        const workspace = workspaceData[0] || null;
        if (!workspace) {
          throw new Error('Workspace not found');
        }

        const domain = getDomain(workspace.domainId);

        // 3. Load appropriate knowledge handler
        let handler: KnowledgeHandler;
        try {
          const handlerModule = await import(
            `@/lib/artifacts/knowledge-types/${params.documentType}/server`
          );
          handler = handlerModule.handler;
        } catch (error) {
          logger.error('Failed to load knowledge handler', {
            type: params.documentType,
            error,
          });
          throw new Error(`Unknown knowledge type: ${params.documentType}`);
        }

        // 4. Generate title for the summary
        const summaryTitle = `${handler.metadata.name} - ${rawDoc.title}`;

        // 5. Initialize artifact stream (tell UI what we're creating)
        dataStream.write({
          type: 'data-kind',
          data: 'knowledge',
          transient: true,
        });
        dataStream.write({
          type: 'data-title',
          data: summaryTitle,
          transient: true,
        });
        dataStream.write({ type: 'data-clear', data: null, transient: true });

        // 6. Generate summary with streaming
        logger.info('Generating knowledge summary', {
          type: params.documentType,
          objective: objective.title,
        });

        const summaryContent = await handler.onGenerateKnowledge({
          rawContent: rawDoc.content,
          objectiveTitle: objective.title,
          objectiveDescription: objective.description || undefined,
          instruction: params.instruction || 'Create a comprehensive summary',
          dataStream,
          domain,
          workspace,
          objective,
        });

        // 7. Save knowledge document with metadata
        const knowledgeDoc = await createKnowledgeDocument(
          workspaceId,
          session.user.id,
          {
            objectiveId,
            title: summaryTitle,
            content: summaryContent,
            category: 'knowledge',
            documentType: params.documentType,
            metadata: {
              generatedFrom: params.rawKnowledgeDocumentId,
              generatedAt: new Date().toISOString(),
            },
            // First-class metadata fields
            sourceType: params.sourceType,
            sourceDate: new Date(params.sourceDate),
            participants: params.participants,
            sourceKnowledgeDocumentId: params.rawKnowledgeDocumentId,
          },
        );

        logger.info('Knowledge summary saved', {
          knowledgeDocId: knowledgeDoc.id,
          type: params.documentType,
        });

        // 8. Send document ID and finish signal to UI
        dataStream.write({
          type: 'data-id',
          data: knowledgeDoc.id,
          transient: true,
        });
        dataStream.write({ type: 'data-finish', data: null, transient: true });

        // 9. Return standardized result for UI
        return {
          success: true,
          id: knowledgeDoc.id,
          title: summaryTitle,
          kind: 'knowledge' as const,
          content: summaryContent,
        };
      } catch (error) {
        logger.error('Failed to generate/save knowledge summary', error);
        return {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : 'Failed to process knowledge',
        };
      }
    },
  });
