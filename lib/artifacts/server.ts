import { textDocumentHandler } from '@/artifacts/text/server';
import { meetingSummaryHandler } from '@/artifacts/meeting-summary/server';
import type { ArtifactKind } from '@/components/artifact';
import type { Document } from '../db/schema';
import { saveDocument } from '../db/queries';
import type { Session } from 'next-auth';
import type { UIMessageStreamWriter } from 'ai';
import type { ChatMessage } from '../types';

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
  session: Session;
  metadata?: Record<string, any>;
}

export interface UpdateDocumentCallbackProps {
  document: Document;
  description: string;
  dataStream: UIMessageStreamWriter<ChatMessage>;
  session: Session;
}

export interface DocumentHandler<T = ArtifactKind> {
  kind: T;
  onCreateDocument: (args: CreateDocumentCallbackProps) => Promise<void>;
  onUpdateDocument: (args: UpdateDocumentCallbackProps) => Promise<void>;
}

export function createDocumentHandler<T extends ArtifactKind>(config: {
  kind: T;
  onCreateDocument: (params: CreateDocumentCallbackProps) => Promise<string>;
  onUpdateDocument: (params: UpdateDocumentCallbackProps) => Promise<string>;
}): DocumentHandler<T> {
  return {
    kind: config.kind,
    onCreateDocument: async (args: CreateDocumentCallbackProps) => {
      const draftContent = await config.onCreateDocument({
        id: args.id,
        title: args.title,
        dataStream: args.dataStream,
        session: args.session,
        metadata: args.metadata,
      });

      if (args.session?.user?.id) {
        // Ensure metadata includes documentType based on the handler kind
        let documentType = config.kind;

        // Special handling for meeting-summary handler
        if (config.kind === 'text') {
          // Check if this is coming from the meeting-summary handler
          if (args.metadata?.sourceDocumentIds?.length > 0) {
            documentType = 'meeting-summary';
          } else if (args.title?.toLowerCase().includes('summary')) {
            documentType = 'meeting-summary';
          } else {
            // Default text documents to 'document' type
            documentType = 'document';
          }
        }

        const documentMetadata = {
          ...args.metadata,
          documentType,
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
          metadata: documentMetadata,
          sourceDocumentIds: args.metadata?.sourceDocumentIds || [],
        });
      }

      return;
    },
    onUpdateDocument: async (args: UpdateDocumentCallbackProps) => {
      const draftContent = await config.onUpdateDocument({
        document: args.document,
        description: args.description,
        dataStream: args.dataStream,
        session: args.session,
      });

      if (args.session?.user?.id) {
        await saveDocument({
          id: args.document.id,
          title: args.document.title,
          content: draftContent,
          kind: config.kind,
          userId: args.session.user.id,
        });
      }

      return;
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
