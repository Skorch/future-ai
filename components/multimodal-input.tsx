'use client';

import type { UIMessage } from 'ai';
import {
  useRef,
  useEffect,
  useState,
  useCallback,
  type Dispatch,
  type SetStateAction,
  memo,
} from 'react';
import { toast } from 'sonner';
import { useLocalStorage, useWindowSize } from 'usehooks-ts';

import { ArrowUpIcon, StopIcon } from './icons';
import { Button } from './ui/button';
import { SuggestedActions } from './suggested-actions';
import { getLogger } from '@/lib/logger';

const logger = getLogger('multimodal-input');
import {
  PlaybookCommandPalette,
  PLAYBOOK_MESSAGE_TEMPLATE,
} from '@/components/playbook/playbook-command-palette';
import { Zap, ArrowDown } from 'lucide-react';
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputToolbar,
  PromptInputTools,
  PromptInputSubmit,
} from './elements/prompt-input';
import type { UseChatHelpers } from '@ai-sdk/react';
import { AnimatePresence, motion } from 'framer-motion';
import { useScrollToBottom } from '@/hooks/use-scroll-to-bottom';
import type { ChatMessage } from '@/lib/types';
import type { Chat } from '@/lib/db/schema';
import {
  LARGE_PASTE_THRESHOLD,
  PASTE_SUGGESTION_TIMEOUT,
} from '@/lib/constants';

function PureMultimodalInput({
  chatId,
  workspaceId,
  input,
  setInput,
  status,
  stop,
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

  const convertToAttachment = useCallback(async () => {
    // Paste-to-attachment feature removed
    // Keep text in input instead
    if (pastedText) {
      setInput((prev) => prev + pastedText);
    }
    setShowPasteSuggestion(false);
    setPastedText('');
    if (pasteTimeoutRef.current) {
      clearTimeout(pasteTimeoutRef.current);
    }
  }, [pastedText, setInput]);

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

    sendMessage({
      role: 'user',
      parts: [
        {
          type: 'text' as const,
          text: input,
        },
      ],
    });

    setLocalStorageInput('');
    resetHeight();
    setInput('');

    if (width && width > 768) {
      textareaRef.current?.focus();
    }
  }, [
    input,
    setInput,
    sendMessage,
    setLocalStorageInput,
    width,
    chatId,
    workspaceId,
  ]);

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

      {messages.length === 0 && (
        <SuggestedActions
          sendMessage={sendMessage}
          chatId={chatId}
          workspaceId={workspaceId}
        />
      )}

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
              <PlaybookCommandPalette
                workspaceId={workspaceId}
                objectiveId={chat?.objectiveId}
                includeGeneralOption={false}
                disabled={status !== 'ready'}
                trigger={
                  <Button
                    type="button"
                    variant="ghost"
                    className="rounded-md p-[7px] h-fit hover:bg-muted"
                    disabled={status !== 'ready'}
                    aria-label="Select playbook"
                    title="Select playbook to guide conversation"
                  >
                    <Zap size={14} />
                  </Button>
                }
                onSelect={(playbook) => {
                  if (playbook && status === 'ready') {
                    const message = PLAYBOOK_MESSAGE_TEMPLATE(playbook.name);
                    // Send message directly instead of setting input + submitting
                    sendMessage({
                      role: 'user',
                      parts: [
                        {
                          type: 'text',
                          text: message,
                        },
                      ],
                    });
                  }
                }}
              />
            </PromptInputTools>
            {status !== 'ready' ? (
              <>
                {logger.debug('Rendering STOP button - status:', status)}
                <StopButton stop={stop} setMessages={setMessages} />
              </>
            ) : (
              <>
                {logger.debug(
                  'Rendering SUBMIT button - status:',
                  status,
                  'disabled:',
                  !input.trim(),
                )}
                <PromptInputSubmit
                  status={status}
                  disabled={!input.trim()}
                  className="p-3 bg-primary text-primary-foreground rounded-full hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100"
                >
                  <ArrowUpIcon size={20} />
                </PromptInputSubmit>
              </>
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
    if (prevProps.chat !== nextProps.chat) return false;

    return true;
  },
);

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
