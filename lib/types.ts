import { z } from 'zod';
import type { generateDocumentVersion } from './ai/tools/generate-document-version';
import type { askUser } from './ai/tools/ask-user';
import type { InferUITool, UIMessage } from 'ai';

import type { ArtifactKind } from '@/components/artifact';

export type DataPart = { type: 'append-message'; message: string };

export const messageMetadataSchema = z.object({
  createdAt: z.string(),
});

export type MessageMetadata = z.infer<typeof messageMetadataSchema>;

type generateDocumentVersionTool = InferUITool<
  ReturnType<typeof generateDocumentVersion>
>;
type askUserTool = InferUITool<ReturnType<typeof askUser>>;

export type ChatTools = {
  generateDocumentVersion: generateDocumentVersionTool;
  askUser: askUserTool;
};

export type CustomUIDataTypes = {
  textDelta: string;
  imageDelta: string;
  sheetDelta: string;
  codeDelta: string;
  appendMessage: string;
  id: string;
  versionId: string;
  title: string;
  kind: ArtifactKind;
  clear: null;
  finish: null;
  reasoning: string;
  continuationRequest: {
    message: string;
  };
  askUser: {
    question: string;
    purpose: string;
    usage: string;
    options?: Array<{
      label: string;
      rationale?: string;
    }>;
  };
};

export type ChatMessage = UIMessage<
  MessageMetadata,
  CustomUIDataTypes,
  ChatTools
>;

export interface Attachment {
  name: string;
  url: string;
  contentType: string;
}
