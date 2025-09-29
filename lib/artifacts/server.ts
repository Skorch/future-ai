import type { ArtifactKind } from '@/components/artifact';
import type { Document } from '../db/schema';
import type { UIMessageStreamWriter } from 'ai';
import type { ChatMessage } from '../types';
import type { ArtifactMetadata } from './types';

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

export const artifactKinds = ['text'] as const;
