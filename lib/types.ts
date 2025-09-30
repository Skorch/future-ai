import { z } from 'zod';
import type { getWeather } from './ai/tools/get-weather';
import type { createDocument } from './ai/tools/create-document';
import type { updateDocument } from './ai/tools/update-document';
import type { setMode } from './ai/tools/set-mode';
import type { askUser } from './ai/tools/ask-user';
import type { InferUITool, UIMessage } from 'ai';

import type { ArtifactKind } from '@/components/artifact';

export type DataPart = { type: 'append-message'; message: string };

export const messageMetadataSchema = z.object({
  createdAt: z.string(),
});

export type MessageMetadata = z.infer<typeof messageMetadataSchema>;

type weatherTool = InferUITool<typeof getWeather>;
type createDocumentTool = InferUITool<
  Awaited<ReturnType<typeof createDocument>>
>;
type updateDocumentTool = InferUITool<ReturnType<typeof updateDocument>>;
type setModeTool = InferUITool<ReturnType<typeof setMode>>;
type askUserTool = InferUITool<ReturnType<typeof askUser>>;

export type ChatTools = {
  getWeather: weatherTool;
  createDocument: createDocumentTool;
  updateDocument: updateDocumentTool;
  setMode: setModeTool;
  askUser: askUserTool;
};

export type CustomUIDataTypes = {
  textDelta: string;
  imageDelta: string;
  sheetDelta: string;
  codeDelta: string;
  appendMessage: string;
  id: string;
  title: string;
  kind: ArtifactKind;
  clear: null;
  finish: null;
  modeChanged: {
    mode: 'discovery' | 'build';
    reason: string;
    timestamp: string;
  };
  continuationRequest: {
    message: string;
  };
  askUser: {
    question: string;
    context?: string;
    options?: string[];
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
