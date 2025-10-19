'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import {
  PlusIcon,
  FileTextIcon,
  MessageSquare,
  ChevronRightIcon,
  ChevronDownIcon,
  ExternalLinkIcon,
  BookOpen,
  FolderOpen,
  FileEdit,
  Target,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { toggleObjectivePublishAction } from '@/lib/objective/actions';
import type { Objective } from '@/lib/db/objective';
import { AddKnowledgeModal } from '@/components/objective/add-knowledge-modal';
import { DocumentViewer } from '@/components/document-viewer';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { KnowledgeTable } from '@/components/knowledge-table';
import type { KnowledgeDocument } from '@/lib/db/knowledge-document';
import { ObjectiveContextTab } from '@/components/objective/objective-context-tab';

interface Chat {
  id: string;
  title: string;
  createdAt: Date;
  messageCount: number;
}

interface Document {
  document: {
    id: string;
    title: string;
  };
  latestVersion?: {
    id: string;
    content: string;
    createdAt: Date;
  } | null;
}

interface ObjectiveDetailClientProps {
  workspaceId: string;
  objectiveId: string;
  objective: Objective;
  document: Document | null;
  chats: Chat[];
  knowledge: KnowledgeDocument[];
  raw: KnowledgeDocument[];
  objectiveContext: string | null;
  contextUpdatedAt: Date | null;
  objectiveContextPlaceholder: string;
  contextLabels?: {
    tab?: string | null;
    header?: string | null;
    description?: string | null;
  };
  documentLabels?: {
    tab?: string | null;
    header?: string | null;
    description?: string | null;
  };
}

export function ObjectiveDetailClient({
  workspaceId,
  objectiveId,
  objective,
  document,
  chats,
  knowledge,
  raw,
  objectiveContext,
  contextUpdatedAt,
  objectiveContextPlaceholder,
  contextLabels,
  documentLabels,
}: ObjectiveDetailClientProps) {
  const router = useRouter();
  const [isPublished, setIsPublished] = useState(
    objective.status === 'published',
  );
  const [isToggling, setIsToggling] = useState(false);
  const [isAddKnowledgeOpen, setIsAddKnowledgeOpen] = useState(false);
  const [isVersionHistoryOpen, setIsVersionHistoryOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('context');

  const handleTogglePublish = async (checked: boolean) => {
    setIsToggling(true);
    setIsPublished(checked); // Optimistic update

    try {
      const result = await toggleObjectivePublishAction(objectiveId, checked);

      if (result.error) {
        // Revert on error
        setIsPublished(!checked);
        toast.error(checked ? 'Failed to publish' : 'Failed to unpublish');
        return;
      }

      toast.success(checked ? 'Objective published' : 'Objective unpublished');
      router.refresh();
    } catch (error) {
      // Revert on error
      setIsPublished(!checked);
      toast.error(checked ? 'Failed to publish' : 'Failed to unpublish');
    } finally {
      setIsToggling(false);
    }
  };

  // Initialize from URL hash on mount
  useEffect(() => {
    const hash = window.location.hash.slice(1); // Remove '#'
    if (
      hash === 'knowledge' ||
      hash === 'raw' ||
      hash === 'objective' ||
      hash === 'context'
    ) {
      setActiveTab(hash);
    }
  }, []);

  // Update URL hash when tab changes
  const handleTabChange = (value: string) => {
    setActiveTab(value);
    window.history.replaceState(null, '', `#${value}`);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Enhanced Header with Toggle */}
      <div className="border-b">
        <div className="px-6 pt-8 pb-6">
          <div className="flex items-center gap-3 mb-4">
            <SidebarTrigger className="md:hidden" />
            <Link
              href={`/workspace/${workspaceId}`}
              className="text-sm text-muted-foreground hover:underline transition-all"
            >
              ← Back to Workspace
            </Link>
          </div>

          {/* Title Row with Toggle */}
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex-1 min-w-0">
              <h1 className="text-3xl font-bold mb-2 break-words">
                {objective.title}
              </h1>
              {objective.description && (
                <p className="text-lg text-muted-foreground mb-3 break-words">
                  {objective.description}
                </p>
              )}
            </div>

            {/* Published Toggle */}
            <div className="flex items-center gap-2 shrink-0">
              <Switch
                id="published"
                checked={isPublished}
                onCheckedChange={handleTogglePublish}
                disabled={isToggling}
              />
              <Label
                htmlFor="published"
                className="text-sm font-medium cursor-pointer"
              >
                Published
              </Label>
            </div>
          </div>

          {/* Metadata Row */}
          <div className="flex items-center gap-4 flex-wrap">
            <span className="text-sm text-muted-foreground">
              Created{' '}
              {formatDistanceToNow(new Date(objective.createdAt), {
                addSuffix: true,
              })}
            </span>
            {objective.updatedAt &&
              objective.updatedAt.toString() !==
                objective.createdAt.toString() && (
                <span className="text-sm text-muted-foreground">
                  Updated{' '}
                  {formatDistanceToNow(new Date(objective.updatedAt), {
                    addSuffix: true,
                  })}
                </span>
              )}
          </div>
        </div>

        {/* Quick Actions Bar */}
        <div className="px-6 pb-6">
          <div className="flex gap-2 flex-wrap">
            <Button
              asChild
              variant="outline"
              className="flex items-center gap-2 rounded-full hover:bg-muted/50 transition-all"
            >
              <Link
                href={`/workspace/${workspaceId}/chat/new?objectiveId=${objectiveId}`}
              >
                <PlusIcon className="size-4" />
                <span className="font-medium">New Task</span>
              </Link>
            </Button>

            <Button
              variant="outline"
              className="flex items-center gap-2 rounded-full hover:bg-muted/50 transition-all"
              onClick={() => setIsAddKnowledgeOpen(true)}
            >
              <FileTextIcon className="size-4" />
              <span className="font-medium">Add Knowledge</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Add Knowledge Modal */}
      <AddKnowledgeModal
        workspaceId={workspaceId}
        objectiveId={objectiveId}
        open={isAddKnowledgeOpen}
        onOpenChange={setIsAddKnowledgeOpen}
        onSuccess={() => {
          // Modal handles toast, just refresh
          router.refresh();
        }}
      />

      {/* Content Area with Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={handleTabChange}
        className="flex flex-col"
      >
        {/* Tabs Navigation */}
        <div className="border-b px-6 pt-4">
          <TabsList className="h-auto w-full justify-start gap-2 bg-transparent">
            <TabsTrigger
              value="context"
              className="flex flex-col items-center gap-2 w-32 py-3 data-[state=active]:bg-muted hover:bg-muted/50 rounded-full transition-all"
            >
              <FileEdit className="size-4" />
              <span className="text-sm font-medium">
                {contextLabels?.tab || 'Context'}
              </span>
            </TabsTrigger>
            <TabsTrigger
              value="objective"
              className="flex flex-col items-center gap-2 w-32 py-3 data-[state=active]:bg-muted hover:bg-muted/50 rounded-full transition-all"
            >
              <Target className="size-4" />
              <span className="text-sm font-medium text-center leading-tight">
                {documentLabels?.tab || 'Objective Document'}
              </span>
            </TabsTrigger>
            <TabsTrigger
              value="knowledge"
              className="flex flex-col items-center gap-2 w-32 py-3 data-[state=active]:bg-muted hover:bg-muted/50 rounded-full transition-all"
            >
              <BookOpen className="size-5" />
              <span className="text-sm font-medium">
                Knowledge ({knowledge.length})
              </span>
            </TabsTrigger>
            <TabsTrigger
              value="raw"
              className="flex flex-col items-center gap-2 w-32 py-3 data-[state=active]:bg-muted hover:bg-muted/50 rounded-full transition-all"
            >
              <FolderOpen className="size-5" />
              <span className="text-sm font-medium">Raw ({raw.length})</span>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Tab Content */}
        <div className="overflow-auto">
          <TabsContent value="objective" className="mt-0 p-6">
            {document?.latestVersion ? (
              <div className="space-y-6">
                <div className="mb-6">
                  <h2 className="text-xl font-semibold mb-2">
                    {documentLabels?.header || 'Objective Document'}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {documentLabels?.description ||
                      'AI-generated objective document'}
                  </p>
                </div>
                {/* Document Viewer */}
                <Card className="overflow-hidden">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileTextIcon className="size-5" />
                      {document.document.title}
                    </CardTitle>
                    {document.latestVersion && (
                      <CardDescription>
                        Last updated{' '}
                        {formatDistanceToNow(
                          new Date(document.latestVersion.createdAt),
                          {
                            addSuffix: true,
                          },
                        )}
                      </CardDescription>
                    )}
                  </CardHeader>
                  <CardContent className="p-0">
                    <Link
                      href={`/workspace/${workspaceId}/document/${document.document.id}`}
                      className="block relative cursor-pointer group"
                    >
                      {/* Preview Container with Fixed Height */}
                      <div className="relative h-[300px] overflow-hidden">
                        <div className="px-6 pt-4 pb-16">
                          <DocumentViewer
                            content={document.latestVersion.content}
                          />
                        </div>
                        {/* Gradient Fade Overlay */}
                        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-card to-transparent pointer-events-none" />
                      </div>
                      {/* View Full Document Button */}
                      <div className="absolute inset-x-0 bottom-0 flex items-center justify-center pb-4 pointer-events-none">
                        <div className="flex items-center gap-2 px-4 py-2 bg-primary/90 text-primary-foreground rounded-full text-sm font-medium group-hover:bg-primary transition-colors pointer-events-auto">
                          <ExternalLinkIcon className="size-4" />
                          View Full Document
                        </div>
                      </div>
                    </Link>
                  </CardContent>
                </Card>

                {/* Version History */}
                {document.latestVersion && (
                  <Collapsible
                    open={isVersionHistoryOpen}
                    onOpenChange={setIsVersionHistoryOpen}
                  >
                    <Card>
                      <CardHeader className="pb-3">
                        <CollapsibleTrigger className="flex items-center justify-between w-full group">
                          <CardTitle className="text-base font-semibold">
                            Version History
                          </CardTitle>
                          <ChevronDownIcon
                            className={`size-5 text-muted-foreground transition-transform ${
                              isVersionHistoryOpen ? 'rotate-180' : ''
                            }`}
                          />
                        </CollapsibleTrigger>
                      </CardHeader>
                      <CollapsibleContent>
                        <CardContent className="space-y-3 pt-0">
                          <div className="flex items-start gap-3 pb-3 border-b last:border-b-0">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-medium text-sm">
                                  Latest Version
                                </span>
                                <Badge variant="secondary" className="text-xs">
                                  Current
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                Updated{' '}
                                {formatDistanceToNow(
                                  new Date(document.latestVersion.createdAt),
                                  {
                                    addSuffix: true,
                                  },
                                )}
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </CollapsibleContent>
                    </Card>
                  </Collapsible>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <h3 className="text-lg font-semibold mb-2">
                  No document content yet
                </h3>
                <p className="text-muted-foreground">
                  {documentLabels?.description ||
                    'The AI-generated objective document will appear here'}
                </p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="context" className="mt-0 p-6">
            <ObjectiveContextTab
              objectiveId={objectiveId}
              initialContext={objectiveContext}
              lastUpdated={contextUpdatedAt}
              placeholder={objectiveContextPlaceholder}
              customLabels={{
                header: contextLabels?.header,
                description: contextLabels?.description,
              }}
            />
          </TabsContent>

          <TabsContent value="knowledge" className="mt-0 p-6">
            {knowledge.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <h3 className="text-lg font-semibold mb-2">
                  No knowledge documents yet
                </h3>
                <p className="text-muted-foreground">
                  Knowledge documents will appear here as you create summaries
                  and analyses
                </p>
              </div>
            ) : (
              <KnowledgeTable
                documents={knowledge}
                workspaceId={workspaceId}
                hideObjectiveColumn={true}
              />
            )}
          </TabsContent>

          <TabsContent value="raw" className="mt-0 p-6">
            {raw.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <h3 className="text-lg font-semibold mb-2">
                  No raw documents yet
                </h3>
                <p className="text-muted-foreground">
                  Raw documents are uploaded within objectives
                </p>
              </div>
            ) : (
              <KnowledgeTable
                documents={raw}
                workspaceId={workspaceId}
                hideObjectiveColumn={true}
              />
            )}
          </TabsContent>
        </div>
      </Tabs>

      {/* Task History Section - Always Visible */}
      <div className="border-t px-6 pt-4 pb-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold tracking-tight">Task History</h2>
            <span className="text-sm font-medium text-muted-foreground">
              {chats.length} {chats.length === 1 ? 'task' : 'tasks'}
            </span>
          </div>

          {chats.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-16">
                <div className="rounded-full bg-muted p-4 mb-4">
                  <MessageSquare className="size-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-2">No tasks yet</h3>
                <p className="text-sm text-muted-foreground mb-6 text-center max-w-sm">
                  Start your first task to begin working on this objective
                </p>
                <Button asChild className="rounded-full">
                  <Link
                    href={`/workspace/${workspaceId}/chat/new?objectiveId=${objectiveId}`}
                  >
                    <PlusIcon className="size-4 mr-2" />
                    New Task
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3">
              {chats.map((chat) => (
                <Link
                  key={chat.id}
                  href={`/workspace/${workspaceId}/chat/${chat.id}`}
                  className="group"
                >
                  <Card className="hover:shadow-lg transition-all duration-200 cursor-pointer group-hover:translate-y-[-2px]">
                    <CardHeader>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-base font-semibold mb-1 truncate">
                            {chat.title}
                          </CardTitle>
                          <CardDescription className="flex items-center gap-2 flex-wrap text-sm">
                            <span className="flex items-center gap-1">
                              <MessageSquare className="size-3.5" />
                              {chat.messageCount || 0}{' '}
                              {chat.messageCount === 1 ? 'message' : 'messages'}
                            </span>
                            <span className="text-muted-foreground/40">•</span>
                            <span>
                              Updated{' '}
                              {formatDistanceToNow(new Date(chat.createdAt), {
                                addSuffix: true,
                              })}
                            </span>
                          </CardDescription>
                        </div>

                        {/* Hover indicator */}
                        <ChevronRightIcon className="size-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                      </div>
                    </CardHeader>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
