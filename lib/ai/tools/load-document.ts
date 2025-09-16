import { tool } from 'ai';
import { z } from 'zod';
import { getDocumentForUser } from '@/lib/db/queries';
import type { Session } from 'next-auth';

interface LoadDocumentProps {
  session: Session;
}

export const loadDocument = ({ session }: LoadDocumentProps) =>
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
      const document = await getDocumentForUser({
        documentId,
        userId: session.user.id,
        maxChars,
      });

      if (!document) {
        return {
          error: 'DOCUMENT_NOT_FOUND',
          message: 'Document does not exist or you do not have access',
          suggestion: 'Use list-documents to see available documents',
        };
      }

      const percentLoaded = Math.round(
        (document.loadedChars / document.fullContentLength) * 100,
      );

      const loadMessage = document.truncated
        ? `Loaded first ${document.loadedChars.toLocaleString()} of ${document.fullContentLength.toLocaleString()} characters (${percentLoaded}% - approximately ${Math.ceil(
            document.loadedChars / 4,
          ).toLocaleString()} tokens)`
        : `Loaded complete document (${document.fullContentLength.toLocaleString()} characters - approximately ${Math.ceil(
            document.fullContentLength / 4,
          ).toLocaleString()} tokens)`;

      const metadata = document.metadata as {
        documentType?: 'transcript' | 'meeting-summary';
        fileName?: string;
        fileSize?: number;
        uploadedAt?: string;
        meetingDate?: string;
        participants?: string[];
        [key: string]: unknown;
      } | null;

      return {
        id: document.id,
        title: document.title,
        content: document.content,
        metadata: document.metadata,
        sourceDocumentIds: document.sourceDocumentIds,
        createdAt: document.createdAt,
        documentType:
          metadata?.documentType ||
          ('document' as 'transcript' | 'meeting-summary' | 'document'),
        loadInfo: {
          truncated: document.truncated,
          loadedChars: document.loadedChars,
          fullContentLength: document.fullContentLength,
          estimatedTokensLoaded: Math.ceil(document.loadedChars / 4),
          estimatedTokensTotal: Math.ceil(document.fullContentLength / 4),
          percentLoaded,
        },
        loadMessage,
      };
    },
  });
