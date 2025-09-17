'use client';
import { AnimatePresence, motion } from 'framer-motion';
import { memo, useState, useEffect } from 'react';
import type { Vote } from '@/lib/db/schema';
import { DocumentToolResult } from './document';
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
import { SearchIcon, ChevronDownIcon } from 'lucide-react';
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
                            {match.metadata?.meeting_date ? (
                              <span className="flex items-center gap-1">
                                📅{' '}
                                {new Date(
                                  String(match.metadata.meeting_date),
                                ).toLocaleDateString()}
                              </span>
                            ) : null}
                            {match.metadata?.speaker ? (
                              <span className="flex items-center gap-1">
                                👤 {String(match.metadata.speaker)}
                              </span>
                            ) : null}
                            {match.metadata?.sectionTitle ? (
                              <span className="flex items-center gap-1">
                                📝 {String(match.metadata.sectionTitle)}
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
                    />
                  </div>
                );
              }

              if (type === 'tool-requestSuggestions') {
                const { toolCallId, state } = part;

                return (
                  <Tool key={toolCallId} defaultOpen={true}>
                    <ToolHeader type="tool-requestSuggestions" state={state} />
                    <ToolContent>
                      {state === 'input-available' && (
                        <ToolInput input={part.input} />
                      )}
                      {state === 'output-available' && (
                        <ToolOutput
                          output={
                            'error' in part.output ? (
                              <div className="p-2 text-red-500 rounded border">
                                Error: {String(part.output.error)}
                              </div>
                            ) : (
                              <DocumentToolResult
                                type="request-suggestions"
                                result={part.output}
                                isReadonly={isReadonly}
                              />
                            )
                          }
                          errorText={undefined}
                        />
                      )}
                    </ToolContent>
                  </Tool>
                );
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
                const isLLMReranked =
                  toolPart.output?.metadata?.rerankMethod === 'llm' ||
                  toolPart.output?.result?.metadata?.rerankMethod === 'llm' ||
                  toolPart.output?.rerankMethod === 'llm' ||
                  toolPart.output?.result?.rerankMethod === 'llm';

                // Use LLM component for LLM reranked results, otherwise use standard

                if (isLLMReranked) {
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

                console.log(`[Message] Found ${toolName} tool:`, {
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
