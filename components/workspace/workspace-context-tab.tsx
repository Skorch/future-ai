'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MarkdownEditor } from '@/components/markdown';
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
  const [content, setContent] = useState(initialContext || '');

  /**
   * Adapter function to convert the action signature
   * from: (id, content) => Promise<undefined | { error: string }>
   * to: (content) => Promise<void>
   */
  const handleSave = async (newContent: string): Promise<void> => {
    const result = await updateWorkspaceContextAction(workspaceId, newContent);
    if (result?.error) {
      throw new Error(result.error);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{customLabels?.header || 'Workspace Context'}</CardTitle>
        <p className="text-sm text-muted-foreground">
          {customLabels?.description ||
            'AI instructions specific to this workspace, similar to CLAUDE.md'}
        </p>
      </CardHeader>
      <CardContent>
        <MarkdownEditor
          value={content}
          onChange={setContent}
          onSave={handleSave}
          placeholder={placeholder}
          maxLength={5000}
          storageKey={`workspace-context-${workspaceId}`}
          autoSave={true}
          showCharacterCount={true}
          ariaLabel="Workspace context editor"
        />
      </CardContent>
    </Card>
  );
}
