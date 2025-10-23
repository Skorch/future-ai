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
import { getCategoryHandler } from '@/lib/artifacts/category-handlers';

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
  chatId?: string;
  objectiveId: string;
}

export const saveKnowledge = ({
  session,
  dataStream,
  workspaceId,
  chatId,
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

        // 2. Load objective for logging and title generation
        const objective = await getObjectiveById(objectiveId, session.user.id);

        if (!objective) {
          throw new Error('Objective not found or access denied');
        }

        // 3. Load objective with artifact type for summary handler
        const { db } = await import('@/lib/db/queries');
        const { objective: objectiveSchema } = await import('@/lib/db/schema');
        const { eq } = await import('drizzle-orm');

        // Load objective with artifact type for summary builder
        const objectiveWithArtifactType = await db.query.objective.findFirst({
          where: eq(objectiveSchema.id, objectiveId),
          with: {
            summaryArtifactType: true,
          },
        });

        if (!objectiveWithArtifactType?.summaryArtifactType) {
          throw new Error('Objective missing summaryArtifactType');
        }

        // 3. Load summary category handler
        const { handler, artifactType } = await getCategoryHandler(
          objectiveWithArtifactType.summaryArtifactType.id,
        );

        // 4. Generate title for the summary
        const summaryTitle = `${artifactType.label} - ${rawDoc.title}`;

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
          artifactType: artifactType.label,
          objective: objective.title,
        });

        const summaryContent = await handler.generate(artifactType, {
          currentVersion: rawDoc.content, // Raw content as source
          instruction:
            params.instruction || 'Generate knowledge summary from raw content',
          dataStream,
          workspaceId,
          chatId,
          objectiveId,
          session,
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
            documentType: artifactType.label,
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
          artifactType: artifactType.label,
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
