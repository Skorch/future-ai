'use client';

import { useEffect, useState, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import {
  ChevronDown,
  ChevronRight,
  Search,
  Calendar,
  User,
  FileText,
  Hash,
  Folder,
  Link2,
  Layers,
} from 'lucide-react';

interface TopicGroup {
  id: string;
  topic: string;
  matchIds: string[];
}

interface LLMRAGQueryResult {
  output: {
    // DETERMINISTIC: metadata field for preserved values
    metadata?: {
      rerankMethod?: 'llm' | 'voyage' | 'none';
      topicGroups?: TopicGroup[];
      topicCount?: number;
    };
    result?: {
      success?: boolean;
      query?: string;
      matchCount?: number;
      duration?: string;
      matches?: Array<{
        id?: string;
        score?: number;
        content?: string;
        metadata?: Record<string, unknown>;
        topicId?: string;
        merged?: string[];
      }>;
      metadata?: {
        rerankMethod?: 'llm' | 'voyage' | 'none';
        topicGroups?: TopicGroup[];
        topicCount?: number;
      };
      topicGroups?: TopicGroup[];
      rerankMethod?: 'llm' | 'voyage';
    };
    // Alternative location for matches
    success?: boolean;
    query?: string;
    matchCount?: number;
    duration?: string;
    matches?: Array<{
      id?: string;
      score?: number;
      content?: string;
      metadata?: Record<string, unknown>;
      topicId?: string;
      merged?: string[];
    }>;
    topicGroups?: TopicGroup[];
    rerankMethod?: 'llm' | 'voyage';
  };
  isStreaming?: boolean;
}

export function LLMRAGQueryResult({ output, isStreaming }: LLMRAGQueryResult) {
  const [isOpen, setIsOpen] = useState(true);
  const [expandedTopics, setExpandedTopics] = useState<Set<string>>(new Set());
  const [expandedContent, setExpandedContent] = useState<Set<string>>(
    new Set(),
  );

  // Get data from either location (check metadata first for deterministic values)
  const result = output.result || output;
  const matches = result.matches || [];
  // DETERMINISTIC: Check metadata first, then fallback to direct fields
  const topicGroups = useMemo(
    () =>
      result.metadata?.topicGroups ||
      result.topicGroups ||
      output.metadata?.topicGroups ||
      [],
    [
      result.metadata?.topicGroups,
      result.topicGroups,
      output.metadata?.topicGroups,
    ],
  );
  const rerankMethod =
    result.metadata?.rerankMethod ||
    result.rerankMethod ||
    output.metadata?.rerankMethod;
  const duration = result.duration;

  // Auto-collapse after streaming completes
  useEffect(() => {
    if (isStreaming) {
      setIsOpen(true);
    } else {
      const timer = setTimeout(() => {
        setIsOpen(false);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [isStreaming]);

  // Initially expand all topic groups
  useEffect(() => {
    if (topicGroups.length > 0) {
      setExpandedTopics(new Set(topicGroups.map((g) => g.id)));
    }
  }, [topicGroups]);

  const toggleTopic = (topicId: string) => {
    setExpandedTopics((prev) => {
      const next = new Set(prev);
      if (next.has(topicId)) {
        next.delete(topicId);
      } else {
        next.add(topicId);
      }
      return next;
    });
  };

  const toggleContent = (matchId: string) => {
    setExpandedContent((prev) => {
      const next = new Set(prev);
      if (next.has(matchId)) {
        next.delete(matchId);
      } else {
        next.add(matchId);
      }
      return next;
    });
  };

  const formatTimecode = (text: string) => {
    return text.replace(/\[(\d+)s\]/g, (match, seconds) => {
      const s = Number.parseInt(seconds, 10);
      const hours = Math.floor(s / 3600);
      const minutes = Math.floor((s % 3600) / 60);
      const secs = s % 60;
      if (hours > 0) {
        return `[${hours}:${minutes.toString().padStart(2, '0')}:${secs
          .toString()
          .padStart(2, '0')}]`;
      }
      return `[${minutes}:${secs.toString().padStart(2, '0')}]`;
    });
  };

  const getDocumentTitle = (metadata: Record<string, unknown>): string => {
    if (metadata.title && metadata.title !== 'Document') {
      return String(metadata.title);
    }
    const alternatives = [
      'meeting_name',
      'artifactTitle',
      'document_name',
      'fileName',
      'topic',
    ];
    for (const key of alternatives) {
      if (metadata[key]) {
        const value = String(metadata[key]);
        if (key === 'fileName') {
          return value.replace(/\.(txt|md|pdf|doc|docx)$/i, '');
        }
        return value;
      }
    }
    return 'Untitled Document';
  };

  const getDocumentType = (type: unknown): string => {
    const typeStr = String(type || 'document');
    const typeMap: Record<string, string> = {
      transcript: 'Transcript',
      'meeting-memory': 'Meeting Summary',
      document: 'Document',
      artifact: 'Artifact',
    };
    // Return mapped value or capitalize the original type
    return (
      typeMap[typeStr] || typeStr.charAt(0).toUpperCase() + typeStr.slice(1)
    );
  };

  const renderMatch = (
    match: {
      id?: string;
      score?: number;
      content?: string;
      metadata?: Record<string, unknown>;
      merged?: string[];
    },
    index: number,
  ) => {
    const metadata = match.metadata || {};
    const title = getDocumentTitle(metadata);
    const docType = getDocumentType(metadata.documentType);
    const content = formatTimecode(match.content || '');
    const matchId = match.id || `match-${index}`;
    const isExpanded = expandedContent.has(matchId);
    const shouldTruncate = content.length > 200;

    return (
      <div
        key={matchId}
        className="border rounded-lg p-4 bg-card hover:bg-accent/50 transition-colors"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-xs text-muted-foreground">
                [{index + 1}]
              </span>
              <span className="font-medium">{title}</span>
              <Badge variant="secondary" className="text-xs">
                {docType}
              </Badge>
              {match.merged && match.merged.length > 0 && (
                <Badge variant="outline" className="text-xs">
                  <Layers className="size-3 mr-1" />
                  Merged {match.merged.length} chunks
                </Badge>
              )}
            </div>

            {/* Metadata badges */}
            <div className="flex flex-wrap gap-1.5">
              {metadata.meetingDate ? (
                <Badge variant="outline" className="text-xs">
                  <Calendar className="size-3 mr-1" />
                  {new Date(String(metadata.meetingDate)).toLocaleDateString()}
                </Badge>
              ) : null}

              {metadata.speakers &&
              Array.isArray(metadata.speakers) &&
              metadata.speakers.length > 0 ? (
                <Badge variant="outline" className="text-xs">
                  <User className="size-3 mr-1" />
                  {(metadata.speakers as string[]).join(', ')}
                </Badge>
              ) : null}

              {metadata.sectionTitle ? (
                <Badge variant="outline" className="text-xs">
                  <FileText className="size-3 mr-1" />
                  {String(metadata.sectionTitle)}
                </Badge>
              ) : null}

              {metadata.topic ? (
                <Badge variant="outline" className="text-xs">
                  <Folder className="size-3 mr-1" />
                  Topic: {String(metadata.topic)}
                </Badge>
              ) : null}

              {metadata.chunkIndex !== undefined && metadata.totalChunks ? (
                <Badge variant="outline" className="text-xs">
                  <Hash className="size-3 mr-1" />
                  Chunk {String(metadata.chunkIndex)}/
                  {String(metadata.totalChunks)}
                </Badge>
              ) : null}
            </div>
          </div>

          {/* Score badge */}
          <Badge
            variant={
              (match.score || 0) > 0.8
                ? 'default'
                : (match.score || 0) > 0.5
                  ? 'secondary'
                  : 'outline'
            }
            className="text-xs shrink-0"
          >
            {Math.round((match.score || 0) * 100)}% relevant
          </Badge>
        </div>

        {/* Content */}
        <div className="mt-3">
          <div
            className={cn(
              'text-sm text-muted-foreground whitespace-pre-wrap',
              !isExpanded && shouldTruncate && 'line-clamp-3',
            )}
          >
            {content}
          </div>

          {shouldTruncate && (
            <button
              type="button"
              onClick={() => toggleContent(matchId)}
              className="text-xs text-primary hover:underline mt-1"
            >
              {isExpanded ? 'Show less' : 'Show more'}
            </button>
          )}
        </div>

        {/* Footer with file info */}
        {metadata.filePath || metadata.artifactId ? (
          <div className="flex gap-3 mt-3 pt-3 border-t text-xs text-muted-foreground">
            {metadata.filePath ? (
              <span className="flex items-center gap-1">
                <Folder className="size-3" />
                {String(metadata.filePath)}
              </span>
            ) : null}
            {metadata.artifactId ? (
              <span className="flex items-center gap-1">
                <Link2 className="size-3" />
                {String(metadata.artifactId)}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  };

  // Count deduplications
  const dedupeCount = matches.reduce(
    (acc, m) => acc + (m.merged?.length || 0),
    0,
  );

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="flex items-center justify-between w-full p-4 hover:bg-accent/50 transition-colors rounded-t-lg">
        <div className="flex items-center gap-2">
          <Search className="size-4 text-muted-foreground" />
          <span className="text-sm">
            {isStreaming
              ? 'Searching knowledge...'
              : `Searched for ${duration || '0ms'}`}
          </span>
          {matches.length > 0 && (
            <>
              <Badge variant="secondary" className="text-xs">
                {matches.length} sources
              </Badge>
              {dedupeCount > 0 && (
                <Badge variant="outline" className="text-xs">
                  {dedupeCount} duplicates merged
                </Badge>
              )}
              {rerankMethod && (
                <Badge variant="outline" className="text-xs">
                  {rerankMethod === 'llm' ? 'AI Enhanced' : 'Voyage Reranked'}
                </Badge>
              )}
            </>
          )}
        </div>
        {isOpen ? (
          <ChevronDown className="size-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="size-4 text-muted-foreground" />
        )}
      </CollapsibleTrigger>

      <CollapsibleContent className="px-4 pb-4">
        {matches.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-8">
            No relevant information found
          </div>
        ) : (
          <div className="space-y-4">
            {/* Render topic groups if available */}
            {topicGroups.length > 0 ? (
              <>
                {topicGroups.map((group) => {
                  const groupMatches = matches.filter(
                    (m) => m.topicId === group.id,
                  );
                  if (groupMatches.length === 0) return null;

                  return (
                    <div key={group.id} className="space-y-2">
                      <button
                        type="button"
                        onClick={() => toggleTopic(group.id)}
                        className="flex items-center gap-2 text-sm font-semibold hover:text-primary transition-colors w-full text-left"
                      >
                        {expandedTopics.has(group.id) ? (
                          <ChevronDown className="size-4" />
                        ) : (
                          <ChevronRight className="size-4" />
                        )}
                        <span>📚 {group.topic}</span>
                        <Badge variant="outline" className="text-xs ml-2">
                          {groupMatches.length} sources
                        </Badge>
                      </button>

                      {expandedTopics.has(group.id) && (
                        <div className="ml-6 space-y-2">
                          {groupMatches.map((match, idx) =>
                            renderMatch(match, matches.indexOf(match) + 1),
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Ungrouped matches */}
                {(() => {
                  const ungroupedMatches = matches.filter((m) => !m.topicId);
                  if (ungroupedMatches.length === 0) return null;

                  return (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm font-semibold">
                        <span>📄 Other Results</span>
                        <Badge variant="outline" className="text-xs">
                          {ungroupedMatches.length} sources
                        </Badge>
                      </div>
                      <div className="ml-6 space-y-2">
                        {ungroupedMatches.map((match, idx) =>
                          renderMatch(match, matches.indexOf(match) + 1),
                        )}
                      </div>
                    </div>
                  );
                })()}
              </>
            ) : (
              // No topic groups, render all matches
              <div className="space-y-2">
                {matches.map((match, index) => renderMatch(match, index + 1))}
              </div>
            )}
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
