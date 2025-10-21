import { tool } from 'ai';
import type { UIMessageStreamWriter } from 'ai';
import { z } from 'zod';
import { fetchSourceDocuments } from '@/lib/artifacts/document-types/base-handler';
import {
  getVersionByChatId,
  updateVersionContent,
} from '@/lib/db/objective-document';
import {
  generateFromArtifactType,
  validateArtifactTypeForGeneration,
} from '@/lib/db/queries/artifact-handler';
import type { ArtifactType } from '@/lib/db/schema';
import { getLogger } from '@/lib/logger';
import type { ChatMessage } from '@/lib/types';

const logger = getLogger('generate-document-version');

interface ToolContext {
  session: { user: { id: string } };
  dataStream: UIMessageStreamWriter<ChatMessage>;
  workspaceId: string;
  chatId: string;
  objectiveId: string;
  artifactType: ArtifactType | null;
}

export const generateDocumentVersion = ({
  session,
  dataStream,
  workspaceId,
  chatId,
  objectiveId,
  artifactType,
}: ToolContext) =>
  tool({
    description: `Generate or update document content for the current chat's version.

IMPORTANT: The document type is ALREADY DETERMINED by the objective this chat belongs to.
You do not need to specify the document type - it's automatically retrieved from the objective's artifact type configuration.

Use this tool when the user asks to:
- "Create a draft"
- "Generate the document"
- "Update the document with new information"
- "Regenerate based on new sources"

The tool will use the objective's configured artifact type automatically.`,

    inputSchema: z.object({
      instruction: z
        .string()
        .describe(
          'Instructions for generating the document content from source materials',
        ),
      primarySourceDocumentId: z
        .string()
        .uuid()
        .optional()
        .describe('Main document being analyzed'),
      referenceDocumentIds: z
        .array(z.string().uuid())
        .optional()
        .describe('Supporting documents for context'),
    }),

    execute: async ({
      instruction,
      primarySourceDocumentId,
      referenceDocumentIds,
    }) => {
      const startTime = Date.now();

      try {
        // 1. Validate artifact type configuration
        const validation = validateArtifactTypeForGeneration(artifactType);
        if (!validation.valid) {
          return {
            success: false,
            error: validation.error,
          };
        }

        const validArtifactType = validation.artifactType;

        // 2. Get version for this chat
        const result = await getVersionByChatId(chatId);
        if (!result) {
          return {
            success: false,
            error: 'No version found for this chat. Please start a new chat.',
          };
        }

        const { version } = result;

        // 3. Combine source document IDs
        const sourceDocumentIds = [
          ...(primarySourceDocumentId ? [primarySourceDocumentId] : []),
          ...(referenceDocumentIds || []),
        ];

        logger.info('Starting document generation', {
          versionId: version.id,
          artifactTypeLabel: validArtifactType.label,
          objectiveId,
          sourceCount: sourceDocumentIds.length,
          sourceIds: sourceDocumentIds,
          hasInstruction: !!instruction,
        });

        // 4. Load source documents ONCE (if provided)
        let sourceContent = '';
        if (sourceDocumentIds.length > 0) {
          logger.info('Loading source documents', {
            count: sourceDocumentIds.length,
          });

          sourceContent = await fetchSourceDocuments(
            sourceDocumentIds,
            workspaceId,
          );

          logger.info('Source documents loaded', {
            totalLength: sourceContent.length,
            hasContent: !!sourceContent,
            preview: sourceContent.substring(0, 200),
          });
        } else {
          logger.warn('No source documents provided', {
            artifactTypeLabel: validArtifactType.label,
            instruction: instruction.substring(0, 100),
          });
        }

        // 5. Initialize artifact stream
        dataStream.write({ type: 'data-kind', data: 'text', transient: true });
        dataStream.write({
          type: 'data-id',
          data: version.documentId, // Send document envelope ID for routing
          transient: true,
        });
        dataStream.write({
          type: 'data-versionId',
          data: version.id, // Send specific version ID for this chat
          transient: true,
        });
        dataStream.write({
          type: 'data-title',
          data: validArtifactType.title,
          transient: true,
        });
        dataStream.write({ type: 'data-clear', data: null, transient: true });

        // 6. Generate content using database-driven artifact type
        logger.info('Generating content from artifact type', {
          artifactTypeId: validArtifactType.id,
          artifactTypeLabel: validArtifactType.label,
          hasSourceContent: !!sourceContent,
          sourceContentLength: sourceContent.length,
        });

        const generatedContent = await generateFromArtifactType(
          validArtifactType,
          {
            sourceContent,
            instruction,
            dataStream,
          },
        );

        // 7. Save generated content to document version
        await updateVersionContent(version.id, generatedContent);

        dataStream.write({ type: 'data-finish', data: null, transient: true });

        const duration = Date.now() - startTime;
        logger.info('Content generated successfully', {
          documentId: version.documentId,
          versionId: version.id,
          artifactTypeLabel: validArtifactType.label,
          contentLength: generatedContent.length,
          duration,
        });

        return {
          id: version.documentId, // Document envelope ID (for routing)
          versionId: version.id, // Version ID (for tracking)
          title: validArtifactType.title,
          kind: 'text' as const,
          documentType: validArtifactType.label,
          success: true,
          message: `Document content has been generated and is displayed above. Use loadDocument to review the full content, then ask the user for feedback.`,
        };
      } catch (error: unknown) {
        const duration = Date.now() - startTime;
        logger.error('Generation failed', { error, duration, chatId });

        return {
          success: false,
          error:
            error instanceof Error ? error.message : 'Unknown error occurred',
        };
      }
    },
  });
