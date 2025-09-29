import { smoothStream, streamText } from 'ai';
import { myProvider } from '@/lib/ai/providers';
import { saveDocument } from '@/lib/db/queries';
import { updateDocumentPrompt } from '@/lib/ai/prompts';
import type {
  DocumentHandler,
  CreateDocumentCallbackProps,
  UpdateDocumentCallbackProps,
} from '@/lib/artifacts/server';

export const textDocumentHandler: DocumentHandler<'text'> = {
  kind: 'text',
  onCreateDocument: async ({
    id,
    title,
    dataStream,
    metadata,
    session,
    workspaceId,
  }: CreateDocumentCallbackProps) => {
    let draftContent = '';

    const { fullStream } = streamText({
      model: myProvider.languageModel('artifact-model'),
      system:
        'Write about the given topic. Markdown is supported. Use headings wherever appropriate.',
      experimental_transform: smoothStream({ chunking: 'word' }),
      prompt: title,
    });

    for await (const delta of fullStream) {
      const { type } = delta;

      if (type === 'text-delta') {
        const { text } = delta;

        draftContent += text;

        dataStream.write({
          type: 'data-textDelta',
          data: text,
          transient: true,
        });
      }
    }

    // Save document directly
    if (session?.user?.id) {
      await saveDocument({
        id,
        title,
        content: draftContent,
        kind: 'text',
        userId: session.user.id,
        workspaceId,
        metadata: {
          ...metadata,
          documentType: metadata?.documentType || 'text',
        },
      });
    }

    return;
  },
  onUpdateDocument: async ({
    document,
    description,
    dataStream,
    session,
    workspaceId,
  }: UpdateDocumentCallbackProps) => {
    let draftContent = '';

    const { fullStream } = streamText({
      model: myProvider.languageModel('artifact-model'),
      system: updateDocumentPrompt(document.content, 'text'),
      experimental_transform: smoothStream({ chunking: 'word' }),
      prompt: description,
      providerOptions: {
        openai: {
          prediction: {
            type: 'content',
            content: document.content,
          },
        },
      },
    });

    for await (const delta of fullStream) {
      const { type } = delta;

      if (type === 'text-delta') {
        const { text } = delta;

        draftContent += text;

        dataStream.write({
          type: 'data-textDelta',
          data: text,
          transient: true,
        });
      }
    }

    // Save updated document
    if (session?.user?.id) {
      await saveDocument({
        id: document.id,
        title: document.title,
        content: draftContent,
        kind: 'text',
        userId: session.user.id,
        workspaceId,
      });
    }

    return;
  },
};
