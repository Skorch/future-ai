'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import {
  ChevronDownIcon,
  FileTextIcon,
  FolderOpenIcon,
  CalendarIcon,
  FileIcon,
  AlertCircleIcon,
} from 'lucide-react';

interface DocumentInfo {
  id: string;
  title: string;
  documentType?: string;
  contentLength?: number;
  estimatedTokens?: number;
  createdAt?: string;
  metadata?: Record<string, unknown>;
}

interface DocumentLoadInfo {
  truncated?: boolean;
  loadedChars?: number;
  fullContentLength?: number;
  estimatedTokensLoaded?: number;
  estimatedTokensTotal?: number;
  percentLoaded?: number;
}

interface ListDocumentsResult {
  documents: DocumentInfo[];
  summary?: {
    total: number;
    transcripts: number;
    summaries: number;
    totalSizeBytes: number;
    totalEstimatedTokens: number;
  };
  message?: string;
}

interface LoadDocumentResult {
  id: string;
  title: string;
  content?: string;
  documentType?: string;
  metadata?: Record<string, unknown>;
  loadInfo?: DocumentLoadInfo;
  loadMessage?: string;
  error?: string;
  message?: string;
}

interface LoadDocumentsResult {
  documents?: Array<{
    id: string;
    title: string;
    content: string;
    documentType?: string;
    metadata?: Record<string, unknown>;
    loadInfo?: DocumentLoadInfo;
  }>;
  summary?: {
    documentsLoaded: number;
    documentsRequested: number;
    documentsMissing: number;
    byType?: {
      summaries: number;
      transcripts: number;
      other: number;
    };
    totalCharsLoaded: number;
    totalCharsAvailable: number;
    estimatedTokensLoaded: number;
    estimatedTokensTotal: number;
    percentLoaded: number;
  };
  loadMessage?: string;
  error?: string;
  message?: string;
}

type DocumentToolResultProps =
  | {
      toolName: 'listDocuments';
      result: ListDocumentsResult;
    }
  | {
      toolName: 'loadDocument';
      result: LoadDocumentResult;
    }
  | {
      toolName: 'loadDocuments';
      result: LoadDocumentsResult;
    };

export function DocumentToolResult(props: DocumentToolResultProps) {
  const { toolName, result } = props;
  const [isOpen, setIsOpen] = useState(false);

  const getToolLabel = () => {
    switch (toolName) {
      case 'listDocuments':
        return 'Listed Documents';
      case 'loadDocument':
        return 'Loaded Document';
      case 'loadDocuments':
        return 'Loaded Documents';
      default:
        return 'Document Tool';
    }
  };

  const getToolIcon = () => {
    switch (toolName) {
      case 'listDocuments':
        return <FolderOpenIcon className="size-4 text-muted-foreground shrink-0" />;
      case 'loadDocument':
      case 'loadDocuments':
        return <FileTextIcon className="size-4 text-muted-foreground shrink-0" />;
      default:
        return <FileIcon className="size-4 text-muted-foreground shrink-0" />;
    }
  };

  const getBadgeContent = () => {
    switch (toolName) {
      case 'listDocuments':
        return `${result.documents.length} documents`;
      case 'loadDocument':
        return result.loadInfo?.percentLoaded
          ? `${result.loadInfo.percentLoaded}% loaded`
          : null;
      case 'loadDocuments':
        return result.summary
          ? `${result.summary.documentsLoaded} documents`
          : null;
      default:
        return null;
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatTokens = (tokens: number) => {
    if (tokens < 1000) return `${tokens} tokens`;
    return `${(tokens / 1000).toFixed(1)}k tokens`;
  };

  return (
    <Collapsible
      className="not-prose mb-4 w-full rounded-md border"
      open={isOpen}
      onOpenChange={setIsOpen}
    >
      <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 p-3 min-w-0">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {getToolIcon()}
          <span className="font-medium text-sm truncate">{getToolLabel()}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {getBadgeContent() && (
            <Badge variant="secondary" className="rounded-full text-xs">
              {getBadgeContent()}
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
          {/* Error Display */}
          {('error' in result && result.error) || ('message' in result && result.message && 'error' in result) ? (
            <div className="p-3 bg-destructive/10 text-destructive rounded-md flex items-start gap-2">
              <AlertCircleIcon className="size-4 mt-0.5 shrink-0" />
              <div className="text-sm">
                <div className="font-medium">{result.error || 'Error'}</div>
                {result.message && <div className="mt-1">{result.message}</div>}
              </div>
            </div>
          ) : null}

          {/* Render based on tool type */}
          {toolName === 'listDocuments' && renderListDocuments(result)}
          {toolName === 'loadDocument' && renderLoadDocument(result)}
          {toolName === 'loadDocuments' && renderLoadDocuments(result)}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );

  function renderListDocuments(listResult: ListDocumentsResult) {
    return (
      <>
        {listResult.summary && (
          <div className="p-3 bg-muted/50 rounded-md space-y-2">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Summary
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-muted-foreground">Total Documents:</span>{' '}
                {listResult.summary.total}
              </div>
              <div>
                <span className="text-muted-foreground">Total Size:</span>{' '}
                {formatBytes(listResult.summary.totalSizeBytes)}
              </div>
              <div>
                <span className="text-muted-foreground">Summaries:</span>{' '}
                {listResult.summary.summaries}
              </div>
              <div>
                <span className="text-muted-foreground">Transcripts:</span>{' '}
                {listResult.summary.transcripts}
              </div>
              <div className="col-span-2">
                <span className="text-muted-foreground">Estimated Tokens:</span>{' '}
                {formatTokens(listResult.summary.totalEstimatedTokens)}
              </div>
            </div>
          </div>
        )}

        {listResult.documents.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Documents
            </div>
            <div className="space-y-2">
              {listResult.documents.map((doc) => (
                <div
                  key={doc.id}
                  className="p-2 rounded-md border bg-card/50 hover:bg-card/80 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{doc.title}</div>
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        {doc.documentType && (
                          <Badge variant="outline" className="text-xs">
                            {doc.documentType}
                          </Badge>
                        )}
                        {doc.estimatedTokens && (
                          <span>{formatTokens(doc.estimatedTokens)}</span>
                        )}
                        {doc.createdAt && (
                          <span className="flex items-center gap-1">
                            <CalendarIcon className="size-3" />
                            {new Date(doc.createdAt).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground font-mono">
                      {doc.id.substring(0, 8)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {listResult.documents.length === 0 && listResult.message && (
          <div className="text-sm text-muted-foreground italic">
            {listResult.message}
          </div>
        )}
      </>
    );
  }

  function renderLoadDocument(loadResult: LoadDocumentResult) {
    return (
      <>
        <div className="p-3 bg-muted/50 rounded-md space-y-2">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Document Details
          </div>
          <div className="space-y-1">
            <div className="text-sm">
              <span className="text-muted-foreground">Title:</span> {loadResult.title}
            </div>
            {loadResult.documentType && (
              <div className="text-sm">
                <span className="text-muted-foreground">Type:</span>{' '}
                <Badge variant="outline" className="text-xs ml-1">
                  {loadResult.documentType}
                </Badge>
              </div>
            )}
            {loadResult.id && (
              <div className="text-sm">
                <span className="text-muted-foreground">ID:</span>{' '}
                <span className="font-mono text-xs">{loadResult.id.substring(0, 12)}...</span>
              </div>
            )}
          </div>
        </div>

        {loadResult.loadInfo && (
          <div className="p-3 bg-muted/50 rounded-md space-y-2">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Load Information
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-muted-foreground">Loaded:</span>{' '}
                {loadResult.loadInfo.loadedChars?.toLocaleString()} chars
              </div>
              <div>
                <span className="text-muted-foreground">Total:</span>{' '}
                {loadResult.loadInfo.fullContentLength?.toLocaleString()} chars
              </div>
              <div>
                <span className="text-muted-foreground">Tokens Loaded:</span>{' '}
                {formatTokens(loadResult.loadInfo.estimatedTokensLoaded || 0)}
              </div>
              <div>
                <span className="text-muted-foreground">Total Tokens:</span>{' '}
                {formatTokens(loadResult.loadInfo.estimatedTokensTotal || 0)}
              </div>
              {loadResult.loadInfo.percentLoaded !== undefined && (
                <div className="col-span-2">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Progress:</span>
                    <div className="flex-1 bg-muted rounded-full h-2">
                      <div
                        className="bg-primary rounded-full h-2 transition-all"
                        style={{ width: `${loadResult.loadInfo.percentLoaded}%` }}
                      />
                    </div>
                    <span className="text-xs">{loadResult.loadInfo.percentLoaded}%</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {loadResult.loadMessage && (
          <div className="p-2 bg-muted/30 rounded-md">
            <div className="text-sm text-muted-foreground">{loadResult.loadMessage}</div>
          </div>
        )}
      </>
    );
  }

  function renderLoadDocuments(loadMultiResult: LoadDocumentsResult) {
    return (
      <>
        {loadMultiResult.summary && (
          <div className="p-3 bg-muted/50 rounded-md space-y-2">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Load Summary
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-muted-foreground">Loaded:</span>{' '}
                {loadMultiResult.summary.documentsLoaded}/{loadMultiResult.summary.documentsRequested}
              </div>
              <div>
                <span className="text-muted-foreground">Missing:</span>{' '}
                {loadMultiResult.summary.documentsMissing}
              </div>
              {loadMultiResult.summary.byType && (
                <>
                  <div>
                    <span className="text-muted-foreground">Summaries:</span>{' '}
                    {loadMultiResult.summary.byType.summaries}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Transcripts:</span>{' '}
                    {loadMultiResult.summary.byType.transcripts}
                  </div>
                </>
              )}
              <div>
                <span className="text-muted-foreground">Chars Loaded:</span>{' '}
                {loadMultiResult.summary.totalCharsLoaded.toLocaleString()}
              </div>
              <div>
                <span className="text-muted-foreground">Chars Total:</span>{' '}
                {loadMultiResult.summary.totalCharsAvailable.toLocaleString()}
              </div>
              <div>
                <span className="text-muted-foreground">Tokens Loaded:</span>{' '}
                {formatTokens(loadMultiResult.summary.estimatedTokensLoaded)}
              </div>
              <div>
                <span className="text-muted-foreground">Tokens Total:</span>{' '}
                {formatTokens(loadMultiResult.summary.estimatedTokensTotal)}
              </div>
              {loadMultiResult.summary.percentLoaded !== undefined && (
                <div className="col-span-2">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Overall Progress:</span>
                    <div className="flex-1 bg-muted rounded-full h-2">
                      <div
                        className="bg-primary rounded-full h-2 transition-all"
                        style={{ width: `${loadMultiResult.summary.percentLoaded}%` }}
                      />
                    </div>
                    <span className="text-xs">{loadMultiResult.summary.percentLoaded}%</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {loadMultiResult.documents && loadMultiResult.documents.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Loaded Documents
            </div>
            <div className="space-y-2">
              {loadMultiResult.documents.map((doc) => (
                <div
                  key={doc.id}
                  className="p-2 rounded-md border bg-card/50 hover:bg-card/80 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{doc.title}</div>
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        {doc.documentType && (
                          <Badge variant="outline" className="text-xs">
                            {doc.documentType}
                          </Badge>
                        )}
                        {doc.loadInfo && (
                          <>
                            {doc.loadInfo.truncated && (
                              <Badge variant="secondary" className="text-xs">
                                Partial
                              </Badge>
                            )}
                            <span>
                              {formatTokens(doc.loadInfo.estimatedTokensLoaded || 0)}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {loadMultiResult.loadMessage && (
          <div className="p-2 bg-muted/30 rounded-md">
            <div className="text-sm text-muted-foreground">{loadMultiResult.loadMessage}</div>
          </div>
        )}
      </>
    );
  }
}