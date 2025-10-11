'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ObjectiveList } from './objective-list';
import { KnowledgeExplorer } from './knowledge-explorer';
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

  // Open dialog if ?create=true query param is present
  useEffect(() => {
    if (searchParams.get('create') === 'true') {
      setShowCreateDialog(true);
      // Clean up URL by removing the query param
      router.replace(`/workspace/${workspace.id}`);
    }
  }, [searchParams, workspace.id, router]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b px-6 py-4">
        <h1 className="text-2xl font-bold">{workspace.name}</h1>
        {workspace.description && (
          <p className="text-muted-foreground mt-1">{workspace.description}</p>
        )}
      </div>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="flex-1 flex flex-col"
      >
        <TabsList className="border-b rounded-none w-full justify-start px-6">
          <TabsTrigger value="objectives" className="rounded-none">
            Objectives ({objectives.length})
          </TabsTrigger>
          <TabsTrigger value="knowledge" className="rounded-none">
            Knowledge ({knowledge.length})
          </TabsTrigger>
          <TabsTrigger value="raw" className="rounded-none">
            Raw ({raw.length})
          </TabsTrigger>
        </TabsList>

        <div className="flex-1 overflow-auto">
          <TabsContent value="objectives" className="mt-0 p-6">
            <ObjectiveList
              workspaceId={workspace.id}
              objectives={objectives}
              showCreateDialog={showCreateDialog}
              setShowCreateDialog={setShowCreateDialog}
            />
          </TabsContent>

          <TabsContent value="knowledge" className="mt-0 p-6">
            <KnowledgeExplorer
              workspaceId={workspace.id}
              documents={knowledge}
              category="knowledge"
            />
          </TabsContent>

          <TabsContent value="raw" className="mt-0 p-6">
            <KnowledgeExplorer
              workspaceId={workspace.id}
              documents={raw}
              category="raw"
            />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
