import { generateUUID } from '@/lib/utils';
import { tool, type UIMessageStreamWriter } from 'ai';
import { z } from 'zod';
import { artifactKinds } from '@/lib/artifacts/server';
import type { ChatMessage } from '@/lib/types';
import {
  getAllDocumentTypes,
  getDocumentTypeDefinition,
  type DocumentType,
} from '@/lib/artifacts';
import type { DomainId } from '@/lib/domains';
import { getDomain } from '@/lib/domains';
import { getLogger } from '@/lib/logger';

const logger = getLogger('CreateDocument');

interface CreateDocumentProps {
  session: { user: { id: string } };
  dataStream: UIMessageStreamWriter<ChatMessage>;
  workspaceId: string;
  domainId: DomainId;
}

// Build schema dynamically based on allowed document types for domain
function createDocumentSchema(allowedTypes: DocumentType[]) {
  return z.object({
    title: z.string().describe('Title for the document'),
    kind: z.enum(artifactKinds).default('text'),
    documentType: z
      .enum(allowedTypes as [DocumentType, ...DocumentType[]])
      .default('text')
      .describe(`Document type. Available types: ${allowedTypes.join(', ')}`),

    primarySourceDocumentId: z
      .string()
      .uuid()
      .optional()
      .describe(
        'The main document to analyze (required for analysis types like sales-call-summary, meeting-analysis). This is the transcript or content being analyzed in THIS generation.',
      ),

    referenceDocumentIds: z
      .array(z.string().uuid())
      .optional()
      .describe(
        'Supporting documents for historical context (optional). For sales-call-summary: include previous call analyses to track deal progression. For meeting-analysis: include previous meetings if comparison requested.',
      ),

    agentInstruction: z
      .string()
      .optional()
      .describe(
        "Custom instructions for the document generation agent. Use this to specify: (1) How to use reference documents, (2) Any custom format or output requirements beyond the standard template, (3) Specific guidance on emphasis areas or analysis focus, (4) Context about the user's goals or downstream usage of this document.",
      ),
    metadata: z
      .record(z.unknown())
      .optional()
      .describe('Additional metadata specific to the document type'),
  });
}

// Build dynamic tool description from registry
// Domain-specific - no cache (descriptions differ by domain)
async function buildToolDescription(domainId: DomainId): Promise<string> {
  try {
    const definitions = await getAllDocumentTypes(domainId);
    const descriptions = definitions
      .map((d) => {
        const required = d.metadata.requiredParams?.includes(
          'sourceDocumentIds',
        )
          ? ' (requires sourceDocumentIds)'
          : '';
        return `- ${d.metadata.type}: ${d.metadata.description}${required}`;
      })
      .join('\n');

    return `Create business documents. Available types:
${descriptions}

Each type may have specific requirements. The tool will guide you if parameters are missing.`;
  } catch (error) {
    logger.warn(
      'Failed to load artifact definitions for tool description',
      error,
    );
    // Fallback description
    return `Create business documents. The tool will guide you through available types and requirements.`;
  }
}

export const createDocument = async ({
  session,
  dataStream,
  workspaceId,
  domainId,
}: CreateDocumentProps) => {
  // Get domain-specific allowed types
  const domain = getDomain(domainId);
  const allowedTypes = domain.allowedTypes;

  // Dynamically build description from registry (filtered by domain)
  const description = await buildToolDescription(domainId);

  return tool({
    description,
    inputSchema: createDocumentSchema(allowedTypes),
    execute: async ({
      title,
      kind,
      documentType,
      primarySourceDocumentId,
      referenceDocumentIds,
      agentInstruction,
      metadata,
    }) => {
      const startTime = Date.now();

      // Combine primary + reference into sourceDocumentIds for handlers
      const sourceDocumentIds = [
        ...(primarySourceDocumentId ? [primarySourceDocumentId] : []),
        ...(referenceDocumentIds || []),
      ];

      logger.debug('Tool executed', {
        title,
        kind,
        documentType,
        primarySourceDocumentId,
        referenceDocumentIds,
        referenceDocCount: referenceDocumentIds?.length || 0,
        combinedSourceDocumentIds: sourceDocumentIds,
        totalSourceDocCount: sourceDocumentIds.length,
        agentInstruction,
        agentInstructionLength: agentInstruction?.length || 0,
        metadata,
        metadataKeys: metadata ? Object.keys(metadata) : [],
        startTime: new Date(startTime).toISOString(),
      });

      const id = generateUUID();
      let isStreamInitialized = false;

      try {
        // sourceDocumentIds is now enforced by schema, no need for runtime check

        // Initialize stream with artifact info
        dataStream.write({
          type: 'data-kind',
          data: kind,
          transient: true,
        });

        dataStream.write({
          type: 'data-id',
          data: id,
          transient: true,
        });

        dataStream.write({
          type: 'data-title',
          data: title,
          transient: true,
        });

        dataStream.write({
          type: 'data-clear',
          data: null,
          transient: true,
        });

        isStreamInitialized = true;

        // Pure dispatcher - lookup handler from registry
        logger.debug(`Looking up handler for documentType: ${documentType}`);

        const documentDef = await getDocumentTypeDefinition(
          documentType || 'text',
        );

        if (!documentDef?.handler) {
          throw new Error(`Unknown document type: ${documentType}`);
        }

        // Pass all parameters to handler via metadata
        // Handlers are responsible for their own validation
        await documentDef.handler.onCreateDocument({
          id,
          title,
          dataStream,
          session,
          workspaceId,
          metadata: {
            ...metadata,
            sourceDocumentIds, // Combined array of primary + reference
            primarySourceDocumentId, // Pass through for handler use
            agentInstruction, // Pass through custom instructions
          },
        });

        dataStream.write({ type: 'data-finish', data: null, transient: true });
        logger.debug('Sent data-finish signal');

        // Return a clear message that prompts the AI to respond
        const responseMessage = `I've created a ${documentType || 'text'} document titled "${title}". The document is displayed above for your review. Load this new document into your context using your tools, then ask the user using your tool call to review.`;

        const returnValue = {
          id,
          title,
          kind,
          documentType: documentType || 'text',
          message: responseMessage,
          success: true,
        };

        const totalDuration = Date.now() - startTime;
        logger.debug('Tool returning success', {
          id,
          title,
          documentType: returnValue.documentType,
          messageLength: responseMessage.length,
          totalDuration,
          durationSeconds: (totalDuration / 1000).toFixed(2),
        });

        return returnValue;
      } catch (error) {
        const errorDuration = Date.now() - startTime;
        logger.error('Error during document creation:', error);
        logger.error('Error occurred after', {
          errorDuration,
          durationSeconds: (errorDuration / 1000).toFixed(2),
        });

        // Clean up artifact display on error
        if (isStreamInitialized) {
          // Reset the artifact to idle state with error message
          dataStream.write({
            type: 'data-title',
            data: `Error: ${title}`,
            transient: true,
          });

          dataStream.write({
            type: 'data-finish',
            data: null,
            transient: true,
          });
        }

        // Determine error message based on error type
        let errorMessage =
          'An unexpected error occurred while creating the document';
        let errorDetails = '';

        if (error instanceof Error) {
          if (error.message.includes('Source documents not found')) {
            errorMessage =
              'Unable to create summary: Some source documents could not be found';
            errorDetails = error.message;
          } else if (
            error.message.includes('timeout') ||
            error.message.includes('maxDuration')
          ) {
            errorMessage =
              'Document creation timed out. The summary may be too complex or the source documents too large';
            errorDetails =
              'Consider breaking down the content into smaller sections';
          } else if (error.message.includes('No document handler')) {
            errorMessage = `Unsupported document type: ${kind}`;
            errorDetails = error.message;
          } else {
            errorDetails = error.message;
          }
        }

        // Log full error for debugging
        logger.error('Full error details:', {
          message: errorMessage,
          details: errorDetails,
          error: error instanceof Error ? error.stack : error,
          documentId: id,
          title,
          kind,
          documentType,
          sourceDocumentIds,
        });

        // Return error response that the AI can understand and relay to the user
        return {
          success: false,
          error: errorMessage,
          documentType: documentType,
          message: `I encountered an error while creating the document "${title}". ${errorMessage}. ${errorDetails ? `Details: ${errorDetails}` : ''}`,
        };
      }
    },
  });
};
