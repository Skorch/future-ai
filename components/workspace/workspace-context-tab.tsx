'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MarkdownEditorProvider } from '@/components/markdown-editor/providers';
import {
  MarkdownEditorView,
  SaveStatus,
  CharacterCounter,
  CharacterLimitWarning,
} from '@/components/markdown-editor/primitives';
import { updateWorkspaceContextAction } from '@/lib/workspace/workspace-context';

interface WorkspaceContextTabProps {
  workspaceId: string;
  initialContext: string | null;
  lastUpdated: Date | null;
  placeholder: string;
  customLabels?: {
    header?: string | null;
    description?: string | null;
  };
}

export function WorkspaceContextTab({
  workspaceId,
  initialContext,
  lastUpdated,
  placeholder,
  customLabels,
}: WorkspaceContextTabProps) {
  return (
    <MarkdownEditorProvider
      id={workspaceId}
      initialContent={initialContext}
      initialLastSaved={lastUpdated}
      storageKey={`workspace-context-${workspaceId}`}
      saveAction={updateWorkspaceContextAction}
      placeholder={placeholder}
      maxLength={5000}
    >
      <Card>
        <CardHeader>
          <CardTitle>{customLabels?.header || 'Workspace Context'}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {customLabels?.description ||
              'AI instructions specific to this workspace, similar to CLAUDE.md'}
          </p>
        </CardHeader>
        <CardContent>
          <MarkdownEditorView />
          <div className="mt-2 flex justify-between text-xs text-muted-foreground">
            <SaveStatus />
            <CharacterCounter />
          </div>
          <CharacterLimitWarning />
        </CardContent>
      </Card>
    </MarkdownEditorProvider>
  );
}
