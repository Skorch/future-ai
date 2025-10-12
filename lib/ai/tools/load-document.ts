import { getLogger } from '@/lib/logger';

const logger = getLogger('LoadDocument');
import { tool } from 'ai';
import { z } from 'zod';
import { getKnowledgeDocumentById } from '@/lib/db/knowledge-document';
import { getObjectiveDocumentById } from '@/lib/db/objective-document';
import type { DocumentType } from '@/lib/artifacts';

// Extended type to include transcript (upload-only, not in registry)
type ExtendedDocumentType = DocumentType | 'transcript';

interface LoadDocumentProps {
  session: { user: { id: string } };
  workspaceId: string;
}

export const loadDocument = ({ session, workspaceId }: LoadDocumentProps) =>
  tool({
    description: `Load a document's content into the conversation context.

CRITICAL: Check document size with list-documents FIRST before loading!

Loading recommendations based on estimated tokens:
- < 5,000 tokens: Load fully (no maxChars needed)
- 5,000-20,000 tokens: Load fully if relevant to the task
- 20,000-50,000 tokens: Use maxChars (e.g., 80000 chars ≈ 20k tokens)
- > 50,000 tokens: Use maxChars (e.g., 40000 chars ≈ 10k tokens) and load more if needed

Token estimation: ~4 characters per token
Character to token examples:
- 20,000 chars ≈ 5,000 tokens
- 40,000 chars ≈ 10,000 tokens
- 80,000 chars ≈ 20,000 tokens
- 120,000 chars ≈ 30,000 tokens

For transcripts: Natural break points occur at speaker changes
For summaries: Usually concise enough to load fully

Context budget reminder: Total conversation limit is ~100,000 tokens.
Reserve space for user messages, your responses, and other tool outputs.`,
    inputSchema: z.object({
      documentId: z
        .string()
        .uuid()
        .describe('ID of the document to load (from list-documents)'),
      maxChars: z
        .number()
        .optional()
        .describe(
          'Maximum characters to load. Omit for full document. Use for large documents to manage context.',
        ),
    }),
    execute: async ({ documentId, maxChars }) => {
      logger.debug('[LoadDocument Tool] Executing load-document tool call:', {
        documentId,
        maxChars: maxChars || 'full',
        userId: session.user.id,
      });

      // Try to load as KnowledgeDocument first, then ObjectiveDocument
      let document: {
        id: string;
        title: string;
        content: string;
        documentType: string;
        createdAt: Date;
        metadata?: Record<string, unknown> | null;
      } | null = null;

      // Try KnowledgeDocument
      const knowledgeDoc = await getKnowledgeDocumentById(
        documentId,
        session.user.id,
      );
      if (knowledgeDoc) {
        document = {
          id: knowledgeDoc.id,
          title: knowledgeDoc.title,
          content: knowledgeDoc.content,
          documentType: knowledgeDoc.documentType,
          createdAt: knowledgeDoc.createdAt,
          metadata: knowledgeDoc.metadata,
        };
      } else {
        // Try ObjectiveDocument
        const objectiveDoc = await getObjectiveDocumentById(
          documentId,
          session.user.id,
        );
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

          document = {
            id: objectiveDoc.document.id,
            title: objectiveDoc.document.title,
            content: objectiveDoc.latestVersion.content,
            documentType,
            createdAt: objectiveDoc.latestVersion.createdAt,
            metadata: objectiveDoc.latestVersion.metadata,
          };
        }
      }

      if (!document) {
        logger.debug('[LoadDocument Tool] Document not found:', documentId);
        return {
          error: 'DOCUMENT_NOT_FOUND',
          message: 'Document does not exist or you do not have access',
          suggestion: 'Use list-documents to see available documents',
        };
      }

      const fullContentLength = document.content?.length || 0;
      const truncated = maxChars && fullContentLength > maxChars;
      const content = truncated
        ? document.content?.slice(0, maxChars) || ''
        : document.content || '';
      const loadedChars = content.length;

      const percentLoaded = Math.round((loadedChars / fullContentLength) * 100);

      const loadMessage = truncated
        ? `Loaded first ${loadedChars.toLocaleString()} of ${fullContentLength.toLocaleString()} characters (${percentLoaded}% - approximately ${Math.ceil(
            loadedChars / 4,
          ).toLocaleString()} tokens)`
        : `Loaded complete document (${fullContentLength.toLocaleString()} characters - approximately ${Math.ceil(
            fullContentLength / 4,
          ).toLocaleString()} tokens)`;

      const metadata = document.metadata as {
        documentType?: ExtendedDocumentType;
        fileName?: string;
        fileSize?: number;
        uploadedAt?: string;
        meetingDate?: string;
        participants?: string[];
        [key: string]: unknown;
      } | null;

      logger.debug('[LoadDocument Tool] Document loaded successfully:', {
        id: document.id,
        title: document.title,
        type: document.documentType,
        loadedChars,
        fullLength: fullContentLength,
        truncated,
        percentLoaded,
        estimatedTokens: Math.ceil(loadedChars / 4),
      });

      // Clean metadata by removing transcript if it exists
      let cleanedMetadata = metadata;
      if (metadata && 'transcript' in metadata) {
        const { transcript, ...rest } = metadata;
        cleanedMetadata = rest;
        logger.warn(
          `[LoadDocument Tool] Removed transcript from metadata for document: ${document.id}`,
        );
      }

      return {
        id: document.id,
        title: document.title,
        content,
        metadata: cleanedMetadata,
        createdAt: document.createdAt,
        documentType: document.documentType,
        loadInfo: {
          truncated,
          loadedChars,
          fullContentLength,
          estimatedTokensLoaded: Math.ceil(loadedChars / 4),
          estimatedTokensTotal: Math.ceil(fullContentLength / 4),
          percentLoaded,
        },
        loadMessage,
      };
    },
  });
