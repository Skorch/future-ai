'use client';

import { DefaultChatTransport } from 'ai';
import { useChat } from '@ai-sdk/react';
import { useEffect, useState, useRef } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { ChatHeader } from '@/components/chat-header';
import type { Vote, Chat as ChatType } from '@/lib/db/schema';
import { fetcher, fetchWithErrorHandlers, generateUUID } from '@/lib/utils';
import { Artifact } from './artifact';
import { MultimodalInput } from './multimodal-input';
import { Messages } from './messages';
import { useArtifactSelector } from '@/hooks/use-artifact';
import { toast } from './toast';
import { useAutoResume } from '@/hooks/use-auto-resume';
import { ChatSDKError } from '@/lib/errors';
import type { Attachment, ChatMessage } from '@/lib/types';
import { getLogger } from '@/lib/logger';

const logger = getLogger('Chat');
import { useDataStream } from './data-stream-provider';

export function Chat({
  id,
  workspaceId,
  initialMessages,
  isReadonly,
  autoResume,
  chat,
  objectiveId,
  initialQuery,
  shouldAutoSubmit = false,
}: {
  id: string;
  workspaceId: string;
  initialMessages: ChatMessage[];
  isReadonly: boolean;
  autoResume: boolean;
  chat?: ChatType | null;
  objectiveId?: string;
  initialQuery?: string;
  shouldAutoSubmit?: boolean;
}) {
  const { mutate } = useSWRConfig();
  const { setDataStream } = useDataStream();

  const [input, setInput] = useState<string>('');

  const {
    messages,
    setMessages,
    sendMessage,
    status,
    stop,
    regenerate,
    resumeStream,
  } = useChat<ChatMessage>({
    id,
    messages: initialMessages,
    experimental_throttle: 100,
    generateId: generateUUID,
    transport: new DefaultChatTransport({
      api: workspaceId ? `/api/workspace/${workspaceId}/chat` : '/api/chat',
      fetch: fetchWithErrorHandlers,
      prepareSendMessagesRequest({ messages, id, body }) {
        return {
          body: {
            id,
            message: messages.at(-1),
            ...(objectiveId && { objectiveId }),
            ...body,
          },
        };
      },
    }),
    onData: (dataPart) => {
      setDataStream((ds) => (ds ? [...ds, dataPart] : []));
    },
    onFinish: () => {
      // Mutate all chat history keys since we can't determine the specific workspace key here
      mutate((key) => typeof key === 'string' && key.includes('/history'));
    },
    onError: (error) => {
      logger.error('Error received:', error);
      logger.error(error);

      // Check for prompt length errors
      const errorMessage =
        error?.message || error?.toString() || 'An error occurred';
      const isPromptTooLong =
        errorMessage.includes('prompt is too long') ||
        errorMessage.includes('AI_APICallError') ||
        (errorMessage.includes('tokens') && errorMessage.includes('maximum'));

      if (isPromptTooLong) {
        // Display prominent error for prompt length issues
        toast({
          type: 'error',
          description: errorMessage,
        });

        // Also add as a message in the chat for visibility
        setMessages((prevMessages) => [
          ...prevMessages,
          {
            id: generateUUID(),
            role: 'assistant',
            parts: [
              {
                type: 'text',
                text: `⚠️ ${errorMessage}\n\nThe conversation has too much content. Consider:\n• Starting a new chat\n• Using document tools to load only specific documents\n• Loading documents with maxChars parameter to limit content`,
              },
            ],
          },
        ]);
      } else if (error instanceof ChatSDKError) {
        toast({
          type: 'error',
          description: error.message,
        });
      } else {
        toast({
          type: 'error',
          description: errorMessage,
        });
      }
    },
  });

  // Track which chat+query combo has been auto-submitted to prevent duplicates
  const autoSubmitKeyRef = useRef<string>('');

  // Clear dataStream when chat id changes
  useEffect(() => {
    setDataStream([]);
  }, [id, setDataStream]);

  // Auto-submit query when explicitly requested (only once per unique chat+query)
  useEffect(() => {
    // Create unique key for this auto-submit scenario
    const currentKey = shouldAutoSubmit ? `${id}-${initialQuery}` : '';

    // Only auto-submit if:
    // 1. All required props are present
    // 2. This specific chat+query combo hasn't been submitted yet
    if (
      initialQuery &&
      shouldAutoSubmit &&
      currentKey !== autoSubmitKeyRef.current
    ) {
      autoSubmitKeyRef.current = currentKey;

      sendMessage({
        role: 'user' as const,
        parts: [{ type: 'text', text: initialQuery }],
      });

      const newUrl = `/workspace/${workspaceId}/chat/${id}`;
      window.history.replaceState({}, '', newUrl);
    }
  }, [initialQuery, shouldAutoSubmit, sendMessage, id, workspaceId]);

  const { data: votes } = useSWR<Array<Vote>>(
    messages.length >= 2 ? `/api/chat/${id}/vote` : null,
    fetcher,
  );

  const [attachments, setAttachments] = useState<Array<Attachment>>([]);
  const isArtifactVisible = useArtifactSelector((state) => state.isVisible);

  useAutoResume({
    autoResume,
    initialMessages,
    resumeStream,
    setMessages,
  });

  return (
    <>
      <div className="flex flex-col min-w-0 h-dvh bg-background">
        <ChatHeader
          chatId={id}
          workspaceId={workspaceId}
          isReadonly={isReadonly}
          objectiveId={objectiveId}
        />

        <Messages
          chatId={id}
          workspaceId={workspaceId}
          status={status}
          votes={votes}
          messages={messages}
          setMessages={setMessages}
          regenerate={regenerate}
          isReadonly={isReadonly}
          isArtifactVisible={isArtifactVisible}
        />

        <div className="sticky bottom-0 flex gap-2 px-4 pb-4 mx-auto w-full bg-background md:pb-6 md:max-w-3xl z-[1] border-t-0">
          {!isReadonly && (
            <MultimodalInput
              chatId={id}
              workspaceId={workspaceId}
              input={input}
              setInput={setInput}
              status={status}
              stop={stop}
              attachments={attachments}
              setAttachments={setAttachments}
              messages={messages}
              setMessages={setMessages}
              sendMessage={sendMessage}
              chat={chat}
            />
          )}
        </div>
      </div>

      <Artifact
        chatId={id}
        workspaceId={workspaceId}
        input={input}
        setInput={setInput}
        status={status}
        stop={stop}
        attachments={attachments}
        setAttachments={setAttachments}
        sendMessage={sendMessage}
        messages={messages}
        setMessages={setMessages}
        regenerate={regenerate}
        votes={votes}
        isReadonly={isReadonly}
      />
    </>
  );
}
