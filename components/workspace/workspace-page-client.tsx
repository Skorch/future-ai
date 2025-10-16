'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { PlusIcon, Target, BookOpen, FolderOpen, FileEdit } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { ObjectiveTable } from '@/components/objective-table';
import { KnowledgeTable } from '@/components/knowledge-table';
import { CreateObjectiveDialog } from './create-objective-dialog';
import { WorkspaceContextTab } from './workspace-context-tab';
import { getDomain } from '@/lib/domains';
import type { Workspace } from '@/lib/db/schema';
import type { Objective } from '@/lib/db/objective';
import type { KnowledgeDocument } from '@/lib/db/knowledge-document';

interface WorkspacePageClientProps {
  workspace: Workspace;
  objectives: Objective[];
  knowledge: KnowledgeDocument[];
  raw: KnowledgeDocument[];
}

export function WorkspacePageClient({
  workspace,
  objectives,
  knowledge,
  raw,
}: WorkspacePageClientProps) {
  const [activeTab, setActiveTab] = useState('objectives');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const searchParams = useSearchParams();
  const router = useRouter();

  // Initialize from URL hash on mount
  useEffect(() => {
    const hash = window.location.hash.slice(1); // Remove '#'
    if (
      hash === 'knowledge' ||
      hash === 'raw' ||
      hash === 'objectives' ||
      hash === 'context'
    ) {
      setActiveTab(hash);
    }
  }, []);

  // Open dialog if ?create=true query param is present
  useEffect(() => {
    if (searchParams.get('create') === 'true') {
      setShowCreateDialog(true);
      // Clean up URL by removing the query param
      router.replace(`/workspace/${workspace.id}`);
    }
  }, [searchParams, workspace.id, router]);

  // Update URL hash when tab changes
  const handleTabChange = (value: string) => {
    setActiveTab(value);
    window.history.replaceState(null, '', `#${value}`);
  };

  return (
    <div className="flex flex-col h-full">
      <Tabs
        value={activeTab}
        onValueChange={handleTabChange}
        className="flex-1 flex flex-col"
      >
        {/* Unified Header + Tabs Section */}
        <div className="border-b">
          {/* Header */}
          <div className="px-6 pt-8 pb-6">
            <div className="flex items-center gap-3">
              <SidebarTrigger className="md:hidden" />
              <div className="flex-1">
                <h1 className="text-2xl font-bold">{workspace.name}</h1>
                {workspace.description && (
                  <p className="text-muted-foreground mt-1">
                    {workspace.description}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Tabs */}
          <TabsList className="h-auto w-full justify-start gap-2 bg-transparent px-6 pb-6">
            <TabsTrigger
              value="objectives"
              className="flex flex-col items-center gap-2 w-32 py-3 data-[state=active]:bg-muted hover:bg-muted/50 rounded-full transition-all"
            >
              <Target className="size-5" />
              <span className="text-sm font-medium">
                Objectives ({objectives.length})
              </span>
            </TabsTrigger>
            <TabsTrigger
              value="context"
              className="flex flex-col items-center gap-2 w-32 py-3 data-[state=active]:bg-muted hover:bg-muted/50 rounded-full transition-all"
            >
              <FileEdit className="size-5" />
              <span className="text-sm font-medium">Context</span>
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

        {/* Content Area */}
        <div className="flex-1 overflow-auto">
          <TabsContent value="objectives" className="mt-0 p-6">
            {objectives.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <h3 className="text-lg font-semibold mb-2">
                  No objectives yet
                </h3>
                <p className="text-muted-foreground mb-6">
                  Create your first objective to get started
                </p>
                <Button onClick={() => setShowCreateDialog(true)}>
                  <PlusIcon className="mr-2 size-4" />
                  New Objective
                </Button>
              </div>
            ) : (
              <ObjectiveTable
                objectives={objectives}
                workspaceId={workspace.id}
              />
            )}
          </TabsContent>

          <TabsContent value="context" className="mt-0 p-6">
            <WorkspaceContextTab
              workspaceId={workspace.id}
              initialContext={workspace.context}
              lastUpdated={workspace.contextUpdatedAt}
              placeholder={
                getDomain(workspace.domainId).workspaceContextPlaceholder
              }
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
                workspaceId={workspace.id}
                objectives={objectives}
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
                workspaceId={workspace.id}
                objectives={objectives}
              />
            )}
          </TabsContent>
        </div>
      </Tabs>

      {/* Dialog rendered once at parent level */}
      <CreateObjectiveDialog
        workspaceId={workspace.id}
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onCreated={(objectiveId) => {
          router.push(`/workspace/${workspace.id}/objective/${objectiveId}`);
        }}
      />
    </div>
  );
}
