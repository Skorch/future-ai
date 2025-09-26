import { textDocumentHandler } from '@/artifacts/text/server';
import { meetingSummaryHandler } from '@/artifacts/meeting-summary/server';
import type { ArtifactKind } from '@/components/artifact';
import type { Document } from '../db/schema';
import { saveDocument } from '../db/queries';
import type { UIMessageStreamWriter } from 'ai';
import type { ChatMessage } from '../types';
import { smoothStream, streamText } from 'ai';
import { myProvider } from '@/lib/ai/providers';
import type { ArtifactMetadata } from './types';
import { ARTIFACT_SYSTEM_PROMPT } from '@/lib/ai/prompts/artifact-system';

export interface SaveDocumentProps {
  id: string;
  title: string;
  kind: ArtifactKind;
  content: string;
  userId: string;
}

export interface CreateDocumentCallbackProps {
  id: string;
  title: string;
  dataStream: UIMessageStreamWriter<ChatMessage>;
  session: { user: { id: string } };
  workspaceId: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateDocumentCallbackProps {
  document: Document;
  description: string;
  dataStream: UIMessageStreamWriter<ChatMessage>;
  session: { user: { id: string } };
  workspaceId: string;
}

export interface DocumentHandler<T = ArtifactKind> {
  kind: T;
  metadata?: ArtifactMetadata;
  onCreateDocument: (args: CreateDocumentCallbackProps) => Promise<void>;
  onUpdateDocument: (args: UpdateDocumentCallbackProps) => Promise<void>;
}

export interface DocumentHandlerConfig<T extends ArtifactKind> {
  kind: T;
  metadata?: ArtifactMetadata;
  composePrompt?: (metadata: ArtifactMetadata) => string;
  onCreateDocument?: (params: CreateDocumentCallbackProps) => Promise<string>;
  onUpdateDocument?: (params: UpdateDocumentCallbackProps) => Promise<string>;
}

export function createDocumentHandler<T extends ArtifactKind>(
  config:
    | DocumentHandlerConfig<T>
    | {
        kind: T;
        onCreateDocument: (
          params: CreateDocumentCallbackProps,
        ) => Promise<string>;
        onUpdateDocument: (
          params: UpdateDocumentCallbackProps,
        ) => Promise<string>;
      },
): DocumentHandler<T> {
  // Handle legacy config format
  if ('metadata' in config || 'composePrompt' in config) {
    return createEnhancedDocumentHandler(config as DocumentHandlerConfig<T>);
  }

  // Legacy handler for backward compatibility
  const legacyConfig = config as {
    kind: T;
    onCreateDocument: (params: CreateDocumentCallbackProps) => Promise<string>;
    onUpdateDocument: (params: UpdateDocumentCallbackProps) => Promise<string>;
  };
  return {
    kind: legacyConfig.kind,
    onCreateDocument: async (args: CreateDocumentCallbackProps) => {
      const draftContent = await legacyConfig.onCreateDocument({
        id: args.id,
        title: args.title,
        dataStream: args.dataStream,
        session: args.session,
        workspaceId: args.workspaceId,
        metadata: args.metadata,
      });

      if (args.session?.user?.id) {
        // Ensure metadata includes documentType based on the handler kind
        let documentType:
          | 'transcript'
          | 'meeting-summary'
          | 'document'
          | undefined;

        // Special handling for meeting-summary handler
        if (legacyConfig.kind === 'text') {
          // Check if this is coming from the meeting-summary handler
          const sourceDocIds = args.metadata?.sourceDocumentIds as
            | string[]
            | undefined;
          if (sourceDocIds && sourceDocIds.length > 0) {
            documentType = 'meeting-summary';
          } else if (args.title?.toLowerCase().includes('summary')) {
            documentType = 'meeting-summary';
          } else {
            // Default text documents to 'document' type
            documentType = 'document';
          }
        } else {
          // For non-text kinds, use undefined (will be handled by database default)
          documentType = undefined;
        }

        const documentMetadata = {
          ...args.metadata,
          documentType,
          artifactId: args.id,
          artifactTitle: args.title,
          artifactType: legacyConfig.kind,
          artifactCreatedAt: new Date().toISOString(),
        };

        await saveDocument({
          id: args.id,
          title: args.title,
          content: draftContent,
          kind: legacyConfig.kind,
          userId: args.session.user.id,
          workspaceId: args.workspaceId,
          metadata: documentMetadata,
          sourceDocumentIds:
            (args.metadata?.sourceDocumentIds as string[] | undefined) || [],
        });
      }

      return;
    },
    onUpdateDocument: async (args: UpdateDocumentCallbackProps) => {
      const draftContent = await legacyConfig.onUpdateDocument({
        document: args.document,
        description: args.description,
        dataStream: args.dataStream,
        session: args.session,
        workspaceId: args.workspaceId,
      });

      if (args.session?.user?.id) {
        await saveDocument({
          id: args.document.id,
          title: args.document.title,
          content: draftContent,
          kind: legacyConfig.kind,
          userId: args.session.user.id,
          workspaceId: args.workspaceId,
        });
      }

      return;
    },
  };
}

// Enhanced document handler with prompt composition
function createEnhancedDocumentHandler<T extends ArtifactKind>(
  config: DocumentHandlerConfig<T>,
): DocumentHandler<T> {
  // Default prompt composition function
  const defaultComposePrompt = (metadata: ArtifactMetadata): string => {
    // Compose: Artifact system prompt + Document specific instructions + Template
    return [
      ARTIFACT_SYSTEM_PROMPT,
      '\n## Document Type Specific Instructions\n',
      metadata.prompt,
      '\n## Required Output Format\n',
      metadata.template,
    ]
      .filter(Boolean)
      .join('\n');
  };

  const composePrompt = config.composePrompt || defaultComposePrompt;

  // Default create implementation with prompt composition
  const defaultOnCreateDocument = async (
    args: CreateDocumentCallbackProps,
  ): Promise<string> => {
    if (!config.metadata) {
      throw new Error('Metadata is required for enhanced document handler');
    }

    const systemPrompt = composePrompt(config.metadata);
    let draftContent = '';

    const { fullStream } = streamText({
      model: myProvider.languageModel('artifact-model'),
      system: systemPrompt,
      maxOutputTokens: 8192, // Testing if token limit affects verbosity
      experimental_transform: smoothStream({ chunking: 'word' }),
      prompt: args.title,
    });

    for await (const delta of fullStream) {
      const { type } = delta;

      if (type === 'text-delta') {
        const { text } = delta;
        draftContent += text;

        args.dataStream.write({
          type: 'data-textDelta',
          data: text,
          transient: true,
        });
      }
    }

    return draftContent;
  };

  return {
    kind: config.kind,
    metadata: config.metadata,
    onCreateDocument: async (args: CreateDocumentCallbackProps) => {
      const createFn = config.onCreateDocument || defaultOnCreateDocument;
      const draftContent = await createFn(args);

      if (args.session?.user?.id) {
        const documentMetadata = {
          ...args.metadata,
          documentType: config.metadata?.type || 'document',
          artifactId: args.id,
          artifactTitle: args.title,
          artifactType: config.kind,
          artifactCreatedAt: new Date().toISOString(),
        };

        await saveDocument({
          id: args.id,
          title: args.title,
          content: draftContent,
          kind: config.kind,
          userId: args.session.user.id,
          workspaceId: args.workspaceId,
          metadata: documentMetadata,
          sourceDocumentIds:
            (args.metadata?.sourceDocumentIds as string[] | undefined) || [],
        });
      }

      return;
    },
    onUpdateDocument: config.onUpdateDocument
      ? async (args: UpdateDocumentCallbackProps) => {
          const draftContent = await config.onUpdateDocument?.(args);

          if (args.session?.user?.id && draftContent) {
            await saveDocument({
              id: args.document.id,
              title: args.document.title,
              content: draftContent,
              kind: config.kind,
              userId: args.session.user.id,
              workspaceId: args.workspaceId,
            });
          }

          return;
        }
      : async () => {
          throw new Error('Update not implemented for this document type');
        },
  };
}

/*
 * Use this array to define the document handlers for each artifact kind.
 */
export const documentHandlersByArtifactKind: Array<DocumentHandler> = [
  textDocumentHandler,
  meetingSummaryHandler,
];

export const artifactKinds = ['text'] as const;
