'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MarkdownEditorProvider } from '@/components/markdown-editor/providers';
import {
  MarkdownEditorView,
  SaveStatus,
  CharacterCounter,
  CharacterLimitWarning,
} from '@/components/markdown-editor/primitives';
import { updateObjectiveActionsAction } from '@/lib/objective/actions';
import { OBJECTIVE_FIELD_MAX_LENGTH } from '@/lib/objective/constants';

interface ObjectiveActionsTabProps {
  objectiveId: string;
  initialActions: string | null;
  actionsUpdatedAt: Date | null;
  placeholder: string;
  customLabels?: {
    header?: string | null;
    description?: string | null;
  };
}

export function ObjectiveActionsTab({
  objectiveId,
  initialActions,
  actionsUpdatedAt,
  placeholder,
  customLabels,
}: ObjectiveActionsTabProps) {
  return (
    <MarkdownEditorProvider
      id={objectiveId}
      initialContent={initialActions}
      initialLastSaved={actionsUpdatedAt}
      storageKey={`objective-actions-${objectiveId}`}
      saveAction={updateObjectiveActionsAction}
      placeholder={placeholder}
      maxLength={OBJECTIVE_FIELD_MAX_LENGTH}
    >
      <Card>
        <CardHeader>
          <CardTitle>{customLabels?.header || 'Objective Actions'}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {customLabels?.description ||
              'Track action items, risks, and blockers for this objective'}
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
