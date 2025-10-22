'use client';

import { getLogger } from '@/lib/logger';

const logger = getLogger('multimodal-input');
import type { UIMessage } from 'ai';
import {
  useRef,
  useEffect,
  useState,
  useCallback,
  type Dispatch,
  type SetStateAction,
  type ChangeEvent,
  memo,
} from 'react';
import { toast } from 'sonner';
import { useLocalStorage, useWindowSize } from 'usehooks-ts';

import { ArrowUpIcon, PaperclipIcon, StopIcon } from './icons';
import { PreviewAttachment } from './preview-attachment';
import { Button } from './ui/button';
import { SuggestedActions } from './suggested-actions';
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputToolbar,
  PromptInputTools,
  PromptInputSubmit,
} from './elements/prompt-input';
import equal from 'fast-deep-equal';
import type { UseChatHelpers } from '@ai-sdk/react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowDown } from 'lucide-react';
import { useScrollToBottom } from '@/hooks/use-scroll-to-bottom';
import type { Attachment, ChatMessage } from '@/lib/types';
import type { Chat } from '@/lib/db/schema';
import {
  LARGE_PASTE_THRESHOLD,
  PASTE_SUGGESTION_TIMEOUT,
} from '@/lib/constants';

// Extended attachment type for transcript documents
interface TranscriptAttachment extends Attachment {
  transcriptMessage?: string;
}

function PureMultimodalInput({
  chatId,
  workspaceId,
  input,
  setInput,
  status,
  stop,
  attachments,
  setAttachments,
  messages,
  setMessages,
  sendMessage,
  className,
  chat,
}: {
  chatId: string;
  workspaceId: string;
  input: string;
  setInput: Dispatch<SetStateAction<string>>;
  status: UseChatHelpers<ChatMessage>['status'];
  stop: () => void;
  attachments: Array<Attachment>;
  setAttachments: Dispatch<SetStateAction<Array<Attachment>>>;
  messages: Array<UIMessage>;
  setMessages: UseChatHelpers<ChatMessage>['setMessages'];
  sendMessage: UseChatHelpers<ChatMessage>['sendMessage'];
  className?: string;
  chat?: Chat | null;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { width } = useWindowSize();

  // State for paste suggestion feature
  const [showPasteSuggestion, setShowPasteSuggestion] = useState(false);
  const [pastedText, setPastedText] = useState<string>('');
  const pasteTimeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (textareaRef.current) {
      adjustHeight();
    }
  }, []);

  const adjustHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = '72px';
    }
  };

  const resetHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = '72px';
    }
  };

  const [localStorageInput, setLocalStorageInput] = useLocalStorage(
    'input',
    '',
  );

  useEffect(() => {
    if (textareaRef.current) {
      const domValue = textareaRef.current.value;
      // Prefer DOM value over localStorage to handle hydration
      const finalValue = domValue || localStorageInput || '';
      setInput(finalValue);
      adjustHeight();
    }
    // Only run once after hydration
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setLocalStorageInput(input);
  }, [input, setLocalStorageInput]);

  const handleInput = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(event.target.value);
  };

  const handlePaste = useCallback(
    async (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const text = event.clipboardData.getData('text');

      if (text.length > LARGE_PASTE_THRESHOLD) {
        event.preventDefault(); // Prevent default paste

        // Store the pasted text temporarily
        setPastedText(text);
        setShowPasteSuggestion(true);

        // Auto-dismiss after timeout
        if (pasteTimeoutRef.current) {
          clearTimeout(pasteTimeoutRef.current);
        }
        pasteTimeoutRef.current = setTimeout(() => {
          // If not converted, add to input
          if (pastedText) {
            setInput((prev) => prev + text);
            setPastedText('');
          }
          setShowPasteSuggestion(false);
        }, PASTE_SUGGESTION_TIMEOUT);
      }
      // Let smaller pastes go through normally
    },
    [setInput, pastedText],
  );

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadQueue, setUploadQueue] = useState<Array<string>>([]);

  const uploadFile = useCallback(
    async (
      file: File,
    ): Promise<TranscriptAttachment | Attachment | undefined> => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('chatId', chatId);

      try {
        const response = await fetch('/api/files/upload', {
          method: 'POST',
          body: formData,
        });

        if (response.ok) {
          const data = await response.json();

          // Handle transcript uploads (new direct document creation)
          if (data.documentId && data.message) {
            // For transcripts, we'll store the message to append to the text
            const transcriptAttachment: TranscriptAttachment = {
              url: `document://${data.documentId}`, // Special URL format for documents
              name: data.fileName,
              contentType: 'application/transcript',
              transcriptMessage: data.message, // Store the TRANSCRIPT_DOCUMENT marker
            };
            return transcriptAttachment;
          }

          // Handle regular file uploads (legacy blob storage)
          const { url, pathname, contentType } = data;
          return {
            url,
            name: pathname,
            contentType: contentType,
          };
        }
        const { error } = await response.json();
        toast.error(error);
      } catch (error) {
        toast.error('Failed to upload file, please try again!');
      }
    },
    [chatId],
  );

  const convertToAttachment = useCallback(async () => {
    if (!pastedText) return;

    // Create a File object from the text
    const file = new File([pastedText], `pasted-text-${Date.now()}.txt`, {
      type: 'text/plain',
    });

    // Clear the paste suggestion UI
    setShowPasteSuggestion(false);
    if (pasteTimeoutRef.current) {
      clearTimeout(pasteTimeoutRef.current);
    }

    // Upload using existing flow
    setUploadQueue([file.name]);
    try {
      const attachment = await uploadFile(file);
      if (attachment) {
        setAttachments((current) => [...current, attachment]);
      }
    } finally {
      setUploadQueue([]);
      setPastedText('');
    }
  }, [pastedText, setAttachments, uploadFile]);

  const keepAsText = useCallback(() => {
    if (pastedText) {
      setInput((prev) => prev + pastedText);
    }
    setShowPasteSuggestion(false);
    setPastedText('');
    if (pasteTimeoutRef.current) {
      clearTimeout(pasteTimeoutRef.current);
    }
  }, [pastedText, setInput]);

  const submitForm = useCallback(() => {
    window.history.replaceState(
      {},
      '',
      `/workspace/${workspaceId}/chat/${chatId}`,
    );

    // Separate transcript attachments from regular file attachments
    const transcriptAttachments = attachments.filter(
      (a): a is TranscriptAttachment =>
        a.contentType === 'application/transcript' &&
        !!(a as TranscriptAttachment).transcriptMessage,
    );
    const regularAttachments = attachments.filter(
      (a) => a.contentType !== 'application/transcript',
    );

    // Build the message text with transcript markers appended
    let messageText = input;
    if (transcriptAttachments.length > 0) {
      const transcriptMarkers = transcriptAttachments
        .map((a) => a.transcriptMessage || '')
        .filter(Boolean)
        .join('\n\n');

      const playbookInstruction =
        'Please use the transcript summary playbook to analyze this transcript.';

      messageText = input
        ? `${input}\n\n${transcriptMarkers}\n\n${playbookInstruction}`
        : `${transcriptMarkers}\n\n${playbookInstruction}`;
    }

    sendMessage({
      role: 'user',
      parts: [
        // Only include regular file attachments as file parts
        ...regularAttachments.map((attachment) => ({
          type: 'file' as const,
          url: attachment.url,
          name: attachment.name, // Using 'name' to match backend schema
          mediaType: attachment.contentType,
        })),
        {
          type: 'text' as const,
          text: messageText,
        },
      ],
    });

    setAttachments([]);
    setLocalStorageInput('');
    resetHeight();
    setInput('');

    if (width && width > 768) {
      textareaRef.current?.focus();
    }
  }, [
    input,
    setInput,
    attachments,
    sendMessage,
    setAttachments,
    setLocalStorageInput,
    width,
    chatId,
    workspaceId,
  ]);

  const handleFileChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files || []);

      setUploadQueue(files.map((file) => file.name));

      try {
        const uploadPromises = files.map((file) => uploadFile(file));
        const uploadedAttachments = await Promise.all(uploadPromises);
        const successfullyUploadedAttachments = uploadedAttachments.filter(
          (attachment) => attachment !== undefined,
        );

        setAttachments((currentAttachments) => [
          ...currentAttachments,
          ...successfullyUploadedAttachments,
        ]);
      } catch (error) {
        logger.error('Error uploading files!', error);
      } finally {
        setUploadQueue([]);
      }
    },
    [setAttachments, uploadFile],
  );

  const { isAtBottom, scrollToBottom } = useScrollToBottom();

  useEffect(() => {
    if (status === 'submitted') {
      scrollToBottom();
    }
  }, [status, scrollToBottom]);

  return (
    <div className="flex relative flex-col gap-4 w-full">
      <AnimatePresence>
        {!isAtBottom && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            className="absolute bottom-28 left-1/2 z-50 -translate-x-1/2"
          >
            <Button
              data-testid="scroll-to-bottom-button"
              className="rounded-full"
              size="icon"
              variant="outline"
              onClick={(event) => {
                event.preventDefault();
                scrollToBottom();
              }}
            >
              <ArrowDown />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {messages.length === 0 &&
        attachments.length === 0 &&
        uploadQueue.length === 0 && (
          <SuggestedActions
            sendMessage={sendMessage}
            chatId={chatId}
            workspaceId={workspaceId}
          />
        )}

      <input
        type="file"
        className="fixed -top-4 -left-4 size-0.5 opacity-0 pointer-events-none"
        ref={fileInputRef}
        multiple
        onChange={handleFileChange}
        accept=".txt,.md,.vtt,.srt,.transcript"
        tabIndex={-1}
      />

      {showPasteSuggestion && (
        <div className="absolute bottom-full mb-2 inset-x-0 mx-4 z-50">
          <div className="bg-background border rounded-lg shadow-lg p-3 flex items-center justify-between">
            <div className="flex-1">
              <p className="text-sm font-medium">
                Large text pasted ({pastedText.length.toLocaleString()}{' '}
                characters)
              </p>
              <p className="text-xs text-muted-foreground">
                Convert to attachment for better handling?
              </p>
            </div>
            <div className="flex gap-2 ml-4">
              <Button size="sm" variant="outline" onClick={keepAsText}>
                Keep as Text
              </Button>
              <Button size="sm" onClick={convertToAttachment}>
                Convert to Attachment
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="relative">
        <PromptInput
          className={`bg-muted border border-border shadow-none transition-all duration-200 hover:ring-1 hover:ring-primary/30 focus-within:ring-1 focus-within:ring-primary/50 rounded-3xl
          }`}
          onSubmit={(event) => {
            event.preventDefault();
            if (status !== 'ready') {
              toast.error('Please wait for the model to finish its response!');
            } else {
              submitForm();
            }
          }}
        >
          {(attachments.length > 0 || uploadQueue.length > 0) && (
            <div
              data-testid="attachments-preview"
              className="flex overflow-x-scroll flex-row gap-2 items-end px-3 py-2"
            >
              {attachments.map((attachment) => (
                <PreviewAttachment
                  key={attachment.url}
                  attachment={attachment}
                  onRemove={() => {
                    setAttachments((currentAttachments) =>
                      currentAttachments.filter(
                        (a) => a.url !== attachment.url,
                      ),
                    );
                    if (fileInputRef.current) {
                      fileInputRef.current.value = '';
                    }
                  }}
                />
              ))}

              {uploadQueue.map((filename) => (
                <PreviewAttachment
                  key={filename}
                  attachment={{
                    url: '',
                    name: filename,
                    contentType: '',
                  }}
                  isUploading={true}
                />
              ))}
            </div>
          )}

          <PromptInputTextarea
            data-testid="multimodal-input"
            ref={textareaRef}
            placeholder="Send a message..."
            value={input}
            onChange={handleInput}
            onPaste={handlePaste}
            minHeight={72}
            maxHeight={200}
            disableAutoResize={true}
            className="text-base resize-none p-4 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] bg-transparent !border-0 !border-none outline-none ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none"
            rows={1}
            autoFocus
          />
          <PromptInputToolbar className="px-4 py-2 !border-t-0 !border-top-0 shadow-none !border-transparent">
            <PromptInputTools className="gap-2">
              <AttachmentsButton fileInputRef={fileInputRef} status={status} />
            </PromptInputTools>
            {status === 'submitted' ? (
              <StopButton stop={stop} setMessages={setMessages} />
            ) : (
              <PromptInputSubmit
                status={status}
                disabled={!input.trim() || uploadQueue.length > 0}
                className="p-3 bg-accent rounded-full hover:bg-accent/80"
              >
                <ArrowUpIcon size={20} />
              </PromptInputSubmit>
            )}
          </PromptInputToolbar>
        </PromptInput>
      </div>
    </div>
  );
}

export const MultimodalInput = memo(
  PureMultimodalInput,
  (prevProps, nextProps) => {
    if (prevProps.input !== nextProps.input) return false;
    if (prevProps.status !== nextProps.status) return false;
    if (!equal(prevProps.attachments, nextProps.attachments)) return false;
    if (prevProps.chat !== nextProps.chat) return false;

    return true;
  },
);

function PureAttachmentsButton({
  fileInputRef,
  status,
}: {
  fileInputRef: React.MutableRefObject<HTMLInputElement | null>;
  status: UseChatHelpers<ChatMessage>['status'];
}) {
  return (
    <Button
      data-testid="attachments-button"
      className="rounded-md rounded-bl-lg p-[7px] h-fit border-border hover:bg-muted"
      onClick={(event) => {
        event.preventDefault();
        fileInputRef.current?.click();
      }}
      disabled={status !== 'ready'}
      variant="ghost"
      aria-label="Attach files (images, text, transcripts, PDFs)"
      title="Attach files (images, text, transcripts, PDFs)"
    >
      <PaperclipIcon size={14} />
    </Button>
  );
}

const AttachmentsButton = memo(PureAttachmentsButton);

function PureStopButton({
  stop,
  setMessages,
}: {
  stop: () => void;
  setMessages: UseChatHelpers<ChatMessage>['setMessages'];
}) {
  return (
    <Button
      data-testid="stop-button"
      className="rounded-full p-1.5 h-fit border border-border"
      onClick={(event) => {
        event.preventDefault();
        stop();
        setMessages((messages) => messages);
      }}
    >
      <StopIcon size={14} />
    </Button>
  );
}

const StopButton = memo(PureStopButton);

function PureSendButton({
  submitForm,
  input,
  uploadQueue,
}: {
  submitForm: () => void;
  input: string;
  uploadQueue: Array<string>;
}) {
  return (
    <Button
      data-testid="send-button"
      className="rounded-full p-1.5 h-fit border border-border"
      onClick={(event) => {
        event.preventDefault();
        submitForm();
      }}
      disabled={input.length === 0 || uploadQueue.length > 0}
    >
      <ArrowUpIcon size={14} />
    </Button>
  );
}

const SendButton = memo(PureSendButton, (prevProps, nextProps) => {
  if (prevProps.uploadQueue.length !== nextProps.uploadQueue.length)
    return false;
  if (prevProps.input !== nextProps.input) return false;
  return true;
});
