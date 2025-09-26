'use client';

import { getLogger } from '@/lib/logger';

const logger = getLogger('message');
import { AnimatePresence, motion } from 'framer-motion';
import { memo, useState, useEffect } from 'react';
import type { Vote } from '@/lib/db/schema';
import { DocumentToolResult as DocumentToolResultDisplay } from './elements/document-tool-result';
import { PencilEditIcon, SparklesIcon } from './icons';
import { Response } from './elements/response';
import { MessageContent } from './elements/message';
import {
  Tool,
  ToolHeader,
  ToolContent,
  ToolInput,
  ToolOutput,
} from './elements/tool';
import { MessageActions } from './message-actions';
import { PreviewAttachment } from './preview-attachment';
import { Weather } from './weather';
import equal from 'fast-deep-equal';
import { cn, sanitizeText } from '@/lib/utils';
import { Button } from './ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';
import { MessageEditor } from './message-editor';
import { DocumentPreview } from './document-preview';
import { MessageReasoning } from './message-reasoning';
import type { UseChatHelpers } from '@ai-sdk/react';
import type { ChatMessage } from '@/lib/types';
import { useDataStream } from './data-stream-provider';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from './ui/collapsible';
import { SearchIcon, ChevronDownIcon, CheckCircleIcon } from 'lucide-react';
import { Badge } from './ui/badge';
import { LLMRAGQueryResult } from './llm-rag-result';

// Type narrowing is handled by TypeScript's control flow analysis
// The AI SDK provides proper discriminated unions for tool calls

// Helper function to format timecodes from seconds or [HHMMss] format
const formatTimecode = (text: string): string => {
  // Match patterns like [2822s] or [283.7s]
  const secondsPattern = /\[(\d+(?:\.\d+)?)s\]/g;

  return text.replace(secondsPattern, (match, seconds) => {
    const totalSeconds = Number.parseFloat(seconds);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const secs = Math.floor(totalSeconds % 60);

    if (hours > 0) {
      return `[${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}]`;
    } else {
      return `[${minutes}:${secs.toString().padStart(2, '0')}]`;
    }
  });
};

// Helper to get meaningful document title
const getDocumentTitle = (
  metadata: Record<string, unknown> | undefined,
): string => {
  if (!metadata) return 'Untitled Document';

  // Priority order for title
  if (metadata.title && metadata.title !== 'Document') {
    return String(metadata.title);
  }
  if (metadata.meeting_name) {
    return String(metadata.meeting_name);
  }
  if (metadata.artifactTitle) {
    return String(metadata.artifactTitle);
  }
  if (metadata.document_name) {
    return String(metadata.document_name);
  }
  if (metadata.fileName) {
    // Clean up file name - remove extension and make readable
    return String(metadata.fileName)
      .replace(/\.[^/.]+$/, '')
      .replace(/[-_]/g, ' ');
  }
  if (metadata.topic) {
    return String(metadata.topic);
  }

  return 'Untitled Document';
};

// Helper to format document type
const getDocumentType = (
  metadata: Record<string, unknown> | undefined,
): string | null => {
  if (!metadata) return null;

  // Check both 'type' and 'documentType' fields
  const docType = metadata.type || metadata.documentType;
  if (!docType) return null;

  const docTypeStr = String(docType);
  const typeMap: Record<string, string> = {
    transcript: 'Transcript',
    'meeting-summary': 'Meeting Summary',
    document: 'Document',
    artifact: 'Artifact',
  };

  return typeMap[docTypeStr] || docTypeStr;
};

// RAG Query Result Component - defined outside to prevent re-creation on every render
const RAGQueryResult = memo(function RAGQueryResult({
  state,
  output,
  input,
}: {
  state: string;
  output: {
    result?: {
      matches: Array<{
        content?: string;
        metadata?: Record<string, unknown>;
        score?: number;
      }>;
    };
    matches?: Array<{
      content?: string;
      metadata?: Record<string, unknown>;
      score?: number;
    }>;
    matchCount?: number;
  };
  input: {
    query?: string;
  };
}) {
  const [isOpen, setIsOpen] = useState(
    state === 'input-streaming' || state === 'input-available',
  );
  const [hasAutoClosedRef, setHasAutoClosedRef] = useState(false);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [duration, setDuration] = useState(0);
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());

  const isStreaming =
    state === 'input-streaming' || state === 'input-available';
  const AUTO_CLOSE_DELAY = 1000;
  const MS_IN_S = 1000;

  const toggleItemExpansion = (idx: number) => {
    setExpandedItems((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(idx)) {
        newSet.delete(idx);
      } else {
        newSet.add(idx);
      }
      return newSet;
    });
  };

  // Track duration when streaming starts and ends
  useEffect(() => {
    if (isStreaming) {
      if (startTime === null) {
        setStartTime(Date.now());
      }
    } else if (startTime !== null) {
      setDuration(Math.round((Date.now() - startTime) / MS_IN_S));
      setStartTime(null);
    }
  }, [isStreaming, startTime]);

  // Auto-open when streaming starts, auto-close when streaming ends (once only)
  useEffect(() => {
    if (
      !isStreaming &&
      isOpen &&
      !hasAutoClosedRef &&
      state === 'output-available'
    ) {
      // Add a small delay before closing to allow user to see the content
      const timer = setTimeout(() => {
        setIsOpen(false);
        setHasAutoClosedRef(true);
      }, AUTO_CLOSE_DELAY);

      return () => clearTimeout(timer);
    }
  }, [isStreaming, isOpen, hasAutoClosedRef, state]);

  const result = state === 'output-available' && output ? output : null;
  const queryInput =
    (state === 'input-available' || state === 'output-available') && input
      ? input
      : null;

  return (
    <Collapsible
      className="not-prose mb-4 w-full rounded-md border"
      open={isOpen}
      onOpenChange={setIsOpen}
    >
      <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 p-3 min-w-0">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <SearchIcon className="size-4 text-muted-foreground shrink-0" />
          <span className="font-medium text-sm truncate">
            {isStreaming || duration === 0
              ? 'Searching knowledge...'
              : `Searched for ${duration} seconds`}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {result?.matchCount !== undefined && (
            <Badge variant="secondary" className="rounded-full text-xs">
              {result.matchCount}{' '}
              {result.matchCount === 1 ? 'source' : 'sources'}
            </Badge>
          )}
          <ChevronDownIcon
            className={cn(
              'size-4 text-muted-foreground transition-transform',
              isOpen ? 'rotate-180' : 'rotate-0',
            )}
          />
        </div>
      </CollapsibleTrigger>

      <CollapsibleContent className="data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-top-2 data-[state=open]:slide-in-from-top-2 text-popover-foreground outline-none data-[state=closed]:animate-out data-[state=open]:animate-in">
        <div className="px-3 pb-3 space-y-3">
          {/* Input query display */}
          {queryInput && (
            <div className="p-2 bg-muted/50 rounded-md">
              <div className="text-xs font-medium text-muted-foreground mb-1">
                Search Query
              </div>
              <div className="text-sm">{queryInput.query}</div>
            </div>
          )}

          {/* RAG Results with source attribution */}
          {(result?.matches || result?.result?.matches)?.length ? (
            <div className="space-y-3">
              <div className="text-xs font-medium text-muted-foreground">
                Retrieved Sources
              </div>

              {(result.matches || result.result?.matches || []).map(
                (
                  match: {
                    content?: string;
                    metadata?: Record<string, unknown>;
                    score?: number;
                  },
                  idx: number,
                ) => {
                  const isExpanded = expandedItems.has(idx);
                  const hasLongContent =
                    match.content && match.content.length > 200;

                  return (
                    <div
                      key={`match-${idx}-${match.metadata?.documentId || ''}`}
                      className="rounded-lg border bg-card/50 p-3 space-y-2 hover:bg-card/80 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                              [{idx + 1}]
                            </span>
                            <span className="text-sm font-medium">
                              {getDocumentTitle(match.metadata)}
                            </span>
                            {getDocumentType(match.metadata) && (
                              <Badge variant="outline" className="text-xs">
                                {getDocumentType(match.metadata)}
                              </Badge>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            {match.metadata?.meetingDate ||
                            match.metadata?.meeting_date ? (
                              <span className="flex items-center gap-1">
                                📅{' '}
                                {new Date(
                                  String(
                                    match.metadata.meetingDate ||
                                      match.metadata.meeting_date,
                                  ),
                                ).toLocaleDateString()}
                              </span>
                            ) : null}
                            {match.metadata?.speakers &&
                            Array.isArray(match.metadata.speakers) &&
                            match.metadata.speakers.length > 0 ? (
                              <span className="flex items-center gap-1">
                                👤{' '}
                                {(match.metadata.speakers as string[]).join(
                                  ', ',
                                )}
                              </span>
                            ) : match.metadata?.speaker ? (
                              <span className="flex items-center gap-1">
                                👤 {String(match.metadata.speaker)}
                              </span>
                            ) : null}
                            {match.metadata?.sectionTitle ? (
                              <span className="flex items-center gap-1">
                                📝 {String(match.metadata.sectionTitle)}
                              </span>
                            ) : null}
                            {match.metadata?.topic ? (
                              <span className="flex items-center gap-1">
                                📂 Topic: {String(match.metadata.topic)}
                              </span>
                            ) : null}
                            {match.metadata?.chunkIndex !== undefined &&
                            match.metadata?.totalChunks ? (
                              <span className="flex items-center gap-1">
                                📄 Chunk {Number(match.metadata.chunkIndex) + 1}
                                /{String(match.metadata.totalChunks)}
                              </span>
                            ) : null}
                          </div>
                        </div>

                        {match.score !== undefined &&
                          !Number.isNaN(match.score) && (
                            <Badge
                              variant={
                                match.score > 0.8
                                  ? 'default'
                                  : match.score > 0.5
                                    ? 'secondary'
                                    : 'outline'
                              }
                              className="text-xs shrink-0"
                            >
                              {(match.score * 100).toFixed(0)}% match
                            </Badge>
                          )}
                      </div>

                      <div className="space-y-2">
                        <div
                          className={cn(
                            'text-sm text-foreground/80 whitespace-pre-wrap',
                            !isExpanded && hasLongContent && 'line-clamp-3',
                          )}
                        >
                          {formatTimecode(match.content || '')}
                        </div>

                        {hasLongContent && (
                          <button
                            type="button"
                            onClick={() => toggleItemExpansion(idx)}
                            className="text-xs text-primary hover:underline flex items-center gap-1"
                          >
                            {isExpanded ? <>▲ Show less</> : <>▼ Show more</>}
                          </button>
                        )}
                      </div>

                      {match.metadata?.file_path ||
                      match.metadata?.artifactId ? (
                        <div className="pt-2 border-t space-y-1">
                          {match.metadata?.file_path ? (
                            <div className="text-xs text-muted-foreground/70 font-mono truncate flex items-center gap-1">
                              📁 {String(match.metadata.file_path)}
                            </div>
                          ) : null}
                          {match.metadata?.artifactId ? (
                            <div className="text-xs text-muted-foreground/50 font-mono flex items-center gap-1">
                              🔗 Document ID:{' '}
                              {String(match.metadata.artifactId)}
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  );
                },
              )}
            </div>
          ) : result && !(result.matches || result.result?.matches)?.length ? (
            <div className="text-sm text-muted-foreground italic">
              No relevant information found for this query.
            </div>
          ) : null}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
});

const PurePreviewMessage = ({
  chatId,
  workspaceId,
  message,
  vote,
  isLoading,
  setMessages,
  regenerate,
  isReadonly,
  requiresScrollPadding,
  isArtifactVisible,
}: {
  chatId: string;
  workspaceId: string;
  message: ChatMessage;
  vote: Vote | undefined;
  isLoading: boolean;
  setMessages: UseChatHelpers<ChatMessage>['setMessages'];
  regenerate: UseChatHelpers<ChatMessage>['regenerate'];
  isReadonly: boolean;
  requiresScrollPadding: boolean;
  isArtifactVisible: boolean;
}) => {
  const [mode, setMode] = useState<'view' | 'edit'>('view');

  const attachmentsFromMessage = message.parts.filter(
    (part) => part.type === 'file',
  );

  useDataStream();

  return (
    <AnimatePresence>
      <motion.div
        data-testid={`message-${message.role}`}
        className="w-full group/message"
        initial={{ y: 5, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        data-role={message.role}
      >
        <div
          className={cn('flex items-start gap-3', {
            'w-full': mode === 'edit',
            'max-w-xl ml-auto justify-end mr-6':
              message.role === 'user' && mode !== 'edit',
            'justify-start -ml-3': message.role === 'assistant',
          })}
        >
          {message.role === 'assistant' && (
            <div className="flex justify-center items-center mt-1 rounded-full ring-1 size-8 shrink-0 ring-border bg-background">
              <SparklesIcon size={14} />
            </div>
          )}

          <div
            className={cn('flex flex-col gap-4', {
              'min-h-96': message.role === 'assistant' && requiresScrollPadding,
              'w-full': message.role === 'assistant',
              'w-fit': message.role === 'user',
            })}
          >
            {attachmentsFromMessage.length > 0 && (
              <div
                data-testid={`message-attachments`}
                className="flex flex-row gap-2 justify-end"
              >
                {attachmentsFromMessage.map((attachment) => (
                  <PreviewAttachment
                    key={attachment.url}
                    attachment={{
                      name: attachment.filename ?? 'file',
                      contentType: attachment.mediaType,
                      url: attachment.url,
                    }}
                  />
                ))}
              </div>
            )}

            {message.parts?.map((part, index) => {
              const { type } = part;
              const key = `message-${message.id}-part-${index}`;

              if (type === 'reasoning' && part.text?.trim().length > 0) {
                return (
                  <MessageReasoning
                    key={key}
                    isLoading={isLoading}
                    reasoning={part.text}
                  />
                );
              }

              if (type === 'text') {
                if (mode === 'view') {
                  return (
                    <div key={key} className="flex flex-row gap-2 items-start">
                      {message.role === 'user' && !isReadonly && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              data-testid="message-edit-button"
                              variant="ghost"
                              className="px-2 rounded-full opacity-0 h-fit text-muted-foreground group-hover/message:opacity-100"
                              onClick={() => {
                                setMode('edit');
                              }}
                            >
                              <PencilEditIcon />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Edit message</TooltipContent>
                        </Tooltip>
                      )}

                      <MessageContent
                        data-testid="message-content"
                        className={cn('justify-start items-start text-left', {
                          'bg-primary text-primary-foreground':
                            message.role === 'user',
                          'bg-transparent -ml-4': message.role === 'assistant',
                        })}
                      >
                        <Response>{sanitizeText(part.text)}</Response>
                      </MessageContent>
                    </div>
                  );
                }

                if (mode === 'edit') {
                  return (
                    <div
                      key={key}
                      className="flex flex-row gap-3 items-start w-full"
                    >
                      <div className="size-8" />
                      <div className="flex-1 min-w-0">
                        <MessageEditor
                          key={message.id}
                          message={message}
                          setMode={setMode}
                          setMessages={setMessages}
                          regenerate={regenerate}
                        />
                      </div>
                    </div>
                  );
                }
              }

              if (type === 'tool-getWeather') {
                const { toolCallId, state } = part;

                return (
                  <Tool key={toolCallId} defaultOpen={true}>
                    <ToolHeader type="tool-getWeather" state={state} />
                    <ToolContent>
                      {state === 'input-available' && (
                        <ToolInput input={part.input} />
                      )}
                      {state === 'output-available' && (
                        <ToolOutput
                          output={<Weather weatherAtLocation={part.output} />}
                          errorText={undefined}
                        />
                      )}
                    </ToolContent>
                  </Tool>
                );
              }

              if (type === 'tool-createDocument') {
                const { toolCallId } = part;

                if (part.output && 'error' in part.output) {
                  return (
                    <div
                      key={toolCallId}
                      className="p-4 text-red-500 bg-red-50 rounded-lg border border-red-200 dark:bg-red-950/50"
                    >
                      Error creating document: {String(part.output.error)}
                    </div>
                  );
                }

                return (
                  <DocumentPreview
                    key={toolCallId}
                    isReadonly={isReadonly}
                    result={part.output}
                    workspaceId={workspaceId}
                  />
                );
              }

              if (type === 'tool-updateDocument') {
                const { toolCallId } = part;

                if (part.output && 'error' in part.output) {
                  return (
                    <div
                      key={toolCallId}
                      className="p-4 text-red-500 bg-red-50 rounded-lg border border-red-200 dark:bg-red-950/50"
                    >
                      Error updating document: {String(part.output.error)}
                    </div>
                  );
                }

                return (
                  <div key={toolCallId} className="relative">
                    <DocumentPreview
                      isReadonly={isReadonly}
                      result={part.output}
                      args={part.output}
                      workspaceId={workspaceId}
                    />
                  </div>
                );
              }

              if (type === 'tool-setMode') {
                const { toolCallId, state } = part;

                return (
                  <Tool key={toolCallId} defaultOpen={true}>
                    <ToolHeader type="tool-setMode" state={state} />
                    <ToolContent>
                      {state === 'input-available' && (
                        <ToolInput input={part.input} />
                      )}
                      {state === 'output-available' && (
                        <ToolOutput
                          output={
                            part.output &&
                            typeof part.output === 'object' &&
                            'message' in part.output ? (
                              <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                  <CheckCircleIcon className="size-4 text-green-600" />
                                  <span className="text-sm font-medium">
                                    {part.output.message}
                                  </span>
                                </div>
                                {part.output.mode && (
                                  <div className="text-xs text-muted-foreground">
                                    New mode:{' '}
                                    <span className="font-medium">
                                      {part.output.mode}
                                    </span>
                                  </div>
                                )}
                                {part.output.reason && (
                                  <div className="text-xs text-muted-foreground">
                                    Reason: {part.output.reason}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="text-sm text-muted-foreground">
                                Mode transition initiated
                              </div>
                            )
                          }
                          errorText={
                            part.output &&
                            typeof part.output === 'object' &&
                            'error' in part.output
                              ? String(part.output.error)
                              : undefined
                          }
                        />
                      )}
                    </ToolContent>
                  </Tool>
                );
              }

              if (type === 'tool-askUser') {
                const { toolCallId, state } = part;
                const input = part.input as
                  | { question: string; context?: string; options?: string[] }
                  | undefined;

                // Show the question UI regardless of state as long as we have input
                if (input?.question) {
                  return (
                    <div key={toolCallId} className="mb-4">
                      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                        <div className="flex items-center gap-2 mb-3">
                          <svg
                            className="w-5 h-5 text-blue-600 dark:text-blue-400"
                            fill="none"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span className="font-semibold text-blue-700 dark:text-blue-300">
                            Question
                          </span>
                        </div>

                        <div className="space-y-3">
                          <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                            {input.question}
                          </p>

                          {input.context && (
                            <p className="text-xs text-gray-600 dark:text-gray-400 italic">
                              {input.context}
                            </p>
                          )}

                          {input.options && input.options.length > 0 && (
                            <div className="pt-3">
                              <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                                Quick responses:
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {input.options.map((option, i) => (
                                  <button
                                    type="button"
                                    key={option}
                                    onClick={() => {
                                      // Find the textarea
                                      const textarea = document.querySelector(
                                        'textarea[data-testid="multimodal-input"]',
                                      ) as HTMLTextAreaElement;
                                      if (!textarea) return;

                                      // Use React's native setter to update the value
                                      const nativeInputValueSetter =
                                        Object.getOwnPropertyDescriptor(
                                          window.HTMLTextAreaElement.prototype,
                                          'value',
                                        )?.set;

                                      if (nativeInputValueSetter) {
                                        nativeInputValueSetter.call(
                                          textarea,
                                          option,
                                        );
                                      }

                                      // Create and dispatch an input event to trigger React's onChange
                                      const event = new Event('input', {
                                        bubbles: true,
                                      });
                                      textarea.dispatchEvent(event);

                                      // Focus the textarea to ensure it's active
                                      textarea.focus();

                                      // Wait a tick for React state to update, then submit
                                      setTimeout(() => {
                                        // Find the form and submit it directly
                                        const form = textarea.closest('form');
                                        if (form) {
                                          // Create and dispatch a submit event
                                          const submitEvent = new Event(
                                            'submit',
                                            {
                                              bubbles: true,
                                              cancelable: true,
                                            },
                                          );
                                          form.dispatchEvent(submitEvent);
                                        }
                                      }, 50);
                                    }}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm
                                             bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700
                                             border border-gray-300 dark:border-gray-600 rounded-md
                                             transition-colors cursor-pointer"
                                  >
                                    {i === 0 && (
                                      <svg
                                        className="w-3.5 h-3.5 text-yellow-500"
                                        fill="currentColor"
                                        viewBox="0 0 20 20"
                                      >
                                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                      </svg>
                                    )}
                                    {option}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          <div className="mt-3 pt-3 border-t border-blue-200 dark:border-blue-800">
                            <p className="text-xs text-blue-600 dark:text-blue-400">
                              Type your answer below or click a quick
                              response...
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                }

                // If no input or question, return null
                return null;
              }

              if ((type as string) === 'tool-queryRAG') {
                const toolPart = part as {
                  toolCallId?: string;
                  state?: string;
                  output?: {
                    // DETERMINISTIC: metadata field for preserved values
                    metadata?: {
                      rerankMethod?: 'llm' | 'voyage' | 'none';
                      topicGroups?: Array<{
                        id: string;
                        topic: string;
                        matchIds: string[];
                      }>;
                      topicCount?: number;
                    };
                    rerankMethod?: 'llm' | 'voyage';
                    result?: {
                      matches: Array<{
                        content?: string;
                        metadata?: Record<string, unknown>;
                        score?: number;
                        topicId?: string;
                        merged?: string[];
                      }>;
                      metadata?: {
                        rerankMethod?: 'llm' | 'voyage' | 'none';
                        topicGroups?: Array<{
                          id: string;
                          topic: string;
                          matchIds: string[];
                        }>;
                      };
                      rerankMethod?: 'llm' | 'voyage';
                      topicGroups?: Array<{
                        id: string;
                        topic: string;
                        matchIds: string[];
                      }>;
                    };
                    // Alternative structure
                    matches?: Array<{
                      content?: string;
                      metadata?: Record<string, unknown>;
                      score?: number;
                      topicId?: string;
                      merged?: string[];
                    }>;
                    topicGroups?: Array<{
                      id: string;
                      topic: string;
                      matchIds: string[];
                    }>;
                  };
                  input?: {
                    query?: string;
                  };
                };
                const { toolCallId, state } = toolPart;

                // DETERMINISTIC: Check metadata field first, then fallback to direct fields
                const rerankMethod =
                  toolPart.output?.metadata?.rerankMethod ||
                  toolPart.output?.result?.metadata?.rerankMethod ||
                  toolPart.output?.rerankMethod ||
                  toolPart.output?.result?.rerankMethod;

                const isLLMReranked = rerankMethod === 'llm';
                const isVoyageReranked = rerankMethod === 'voyage';

                // Use LLM component for LLM reranked results, enhanced component for Voyage
                // Fall back to standard component only when no reranking method is detected

                if (isLLMReranked || isVoyageReranked) {
                  return (
                    <LLMRAGQueryResult
                      key={toolCallId || `rag-${index}`}
                      output={toolPart.output || {}}
                      isStreaming={state === 'partial-call'}
                    />
                  );
                }

                return (
                  <RAGQueryResult
                    key={toolCallId || `rag-${index}`}
                    state={state || 'idle'}
                    output={toolPart.output || {}}
                    input={toolPart.input || {}}
                  />
                );
              }

              // Handle document tools: listDocuments, loadDocument, loadDocuments
              if (
                (type as string) === 'tool-listDocuments' ||
                (type as string) === 'tool-loadDocument' ||
                (type as string) === 'tool-loadDocuments'
              ) {
                const toolPart = part as {
                  toolCallId?: string;
                  state?: string;
                  output?: unknown;
                  input?: unknown;
                };
                const { toolCallId, state } = toolPart;
                const toolName = (type as string).replace('tool-', '') as
                  | 'listDocuments'
                  | 'loadDocument'
                  | 'loadDocuments';

                logger.info(`[Message] Found ${toolName} tool:`, {
                  state,
                  hasOutput: !!toolPart.output,
                  outputKeys: toolPart.output
                    ? Object.keys(toolPart.output)
                    : [],
                });

                // Only render when output is available
                if (state === 'output-available' && toolPart.output) {
                  // Type-safe rendering based on tool name
                  if (toolName === 'listDocuments') {
                    return (
                      <DocumentToolResultDisplay
                        key={toolCallId || `listDocuments-${index}`}
                        toolName="listDocuments"
                        // biome-ignore lint/suspicious/noExplicitAny: existing code
                        result={toolPart.output as any}
                      />
                    );
                  }
                  if (toolName === 'loadDocument') {
                    return (
                      <DocumentToolResultDisplay
                        key={toolCallId || `loadDocument-${index}`}
                        toolName="loadDocument"
                        // biome-ignore lint/suspicious/noExplicitAny: existing code
                        result={toolPart.output as any}
                      />
                    );
                  }
                  if (toolName === 'loadDocuments') {
                    return (
                      <DocumentToolResultDisplay
                        key={toolCallId || `loadDocuments-${index}`}
                        toolName="loadDocuments"
                        // biome-ignore lint/suspicious/noExplicitAny: existing code
                        result={toolPart.output as any}
                      />
                    );
                  }
                }

                // Return null for input states to avoid rendering empty tool blocks
                return null;
              }
            })}

            {!isReadonly && (
              <MessageActions
                key={`action-${message.id}`}
                chatId={chatId}
                workspaceId={workspaceId}
                message={message}
                vote={vote}
                isLoading={isLoading}
              />
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export const PreviewMessage = memo(
  PurePreviewMessage,
  (prevProps, nextProps) => {
    if (prevProps.isLoading !== nextProps.isLoading) return false;
    if (prevProps.message.id !== nextProps.message.id) return false;
    if (prevProps.requiresScrollPadding !== nextProps.requiresScrollPadding)
      return false;
    if (!equal(prevProps.message.parts, nextProps.message.parts)) return false;
    if (!equal(prevProps.vote, nextProps.vote)) return false;

    return false;
  },
);

export const ThinkingMessage = () => {
  const role = 'assistant';

  return (
    <motion.div
      data-testid="message-assistant-loading"
      className="w-full group/message"
      initial={{ y: 5, opacity: 0 }}
      animate={{ y: 0, opacity: 1, transition: { delay: 1 } }}
      data-role={role}
    >
      <div className="flex items-start gap-3 justify-start -ml-3">
        <div className="flex justify-center items-center mt-1 rounded-full ring-1 size-8 shrink-0 ring-border bg-background">
          <SparklesIcon size={14} />
        </div>

        <div className="flex flex-col gap-4 w-full">
          <MessageContent className="bg-transparent -ml-4">
            <div className="text-muted-foreground">Hmm...</div>
          </MessageContent>
        </div>
      </div>
    </motion.div>
  );
};
