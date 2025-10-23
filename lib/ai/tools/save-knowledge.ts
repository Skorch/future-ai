import 'server-only';

import { tool } from 'ai';
import { z } from 'zod';
import {
  createKnowledgeDocument,
  getKnowledgeDocumentById,
  getKnowledgeDocumentBySourceId,
  updateKnowledgeDocument,
} from '@/lib/db/knowledge-document';
import {
  getObjectiveById,
  getObjectiveWithArtifactTypes,
} from '@/lib/db/objective';
import type { UIMessageStreamWriter } from 'ai';
import type { ChatMessage } from '@/lib/types';
import { getLogger } from '@/lib/logger';
import { SummaryHandler } from '@/lib/artifacts/category-handlers/summary-handler';

const logger = getLogger('SaveKnowledge');

// Participant schema for validation
const ParticipantSchema = z.object({
  email: z.string().email().optional(),
  displayName: z.string().min(1),
});

interface SaveKnowledgeProps {
  session: {
    user: {
      id: string;
      firstName: string | null;
      lastName: string | null;
    };
  };
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
        .describe(
          'Provide DETAILED instructions to this Sub-Agent, based on the context you have discussed with the User around what to include or what not to include.',
        ),

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

        // 3. Load objective with artifact types using DAL
        const objectiveWithArtifactTypes = await getObjectiveWithArtifactTypes(
          objectiveId,
          session.user.id,
        );

        if (!objectiveWithArtifactTypes?.summaryArtifactType) {
          throw new Error('Objective missing summaryArtifactType');
        }

        // 4. Check for existing summary (for incremental updates)
        logger.debug('Checking for existing summary', {
          sourceKnowledgeDocumentId: params.rawKnowledgeDocumentId,
          objectiveId,
        });

        const existingSummary = await getKnowledgeDocumentBySourceId(
          params.rawKnowledgeDocumentId,
          objectiveId,
        );

        logger.debug('Existing summary lookup result', {
          found: !!existingSummary,
          existingSummaryId: existingSummary?.id,
          existingSummaryTitle: existingSummary?.title,
          existingSummaryCreatedAt: existingSummary?.createdAt,
          sourceKnowledgeDocumentId: params.rawKnowledgeDocumentId,
          objectiveId,
        });

        // 5. Instantiate handler directly and get artifact type
        const handler = new SummaryHandler();
        const artifactType = objectiveWithArtifactTypes.summaryArtifactType;

        // 6. Generate title for the summary
        const summaryTitle = `${artifactType.label} - ${rawDoc.title}`;

        // 7. Initialize artifact stream (tell UI what we're creating)
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

        // 8. Generate summary with streaming
        logger.info('Generating knowledge summary', {
          artifactType: artifactType.label,
          objective: objective.title,
        });

        const summaryContent = await handler.generate(artifactType, {
          currentVersion: existingSummary?.content,
          sourceDocumentIds: existingSummary
            ? undefined
            : [params.rawKnowledgeDocumentId],
          instruction:
            params.instruction ||
            (existingSummary
              ? 'Update the knowledge summary with any new insights or corrections'
              : 'Generate knowledge summary from the source material'),
          dataStream,
          workspaceId,
          chatId,
          objectiveId,
          session,
        });

        let knowledgeDocId: string;

        if (existingSummary) {
          // 9. Update existing summary
          await updateKnowledgeDocument(existingSummary.id, {
            content: summaryContent,
            metadata: {
              ...(existingSummary.metadata as Record<string, unknown>),
              updatedAt: new Date().toISOString(),
              updateCount:
                (((existingSummary.metadata as Record<string, unknown>)
                  ?.updateCount as number) || 0) + 1,
            },
          });

          knowledgeDocId = existingSummary.id;

          logger.info('Knowledge summary updated', {
            knowledgeDocId: existingSummary.id,
            artifactType: artifactType.label,
            updateCount:
              (((existingSummary.metadata as Record<string, unknown>)
                ?.updateCount as number) || 0) + 1,
          });
        } else {
          // 9. Create new knowledge document
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

          knowledgeDocId = knowledgeDoc.id;

          logger.info('Knowledge summary created', {
            knowledgeDocId: knowledgeDoc.id,
            artifactType: artifactType.label,
          });
        }

        // 10. Send document ID and finish signal to UI
        dataStream.write({
          type: 'data-id',
          data: knowledgeDocId,
          transient: true,
        });
        dataStream.write({ type: 'data-finish', data: null, transient: true });

        // 11. Return standardized result for UI
        return {
          success: true,
          id: knowledgeDocId,
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
