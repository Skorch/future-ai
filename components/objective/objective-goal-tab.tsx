'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MarkdownEditorProvider } from '@/components/markdown-editor/providers';
import {
  MarkdownEditorView,
  SaveStatus,
  CharacterCounter,
  CharacterLimitWarning,
} from '@/components/markdown-editor/primitives';
import { updateObjectiveGoalAction } from '@/lib/objective/actions';
import { OBJECTIVE_FIELD_MAX_LENGTH } from '@/lib/objective/constants';

interface ObjectiveGoalTabProps {
  objectiveId: string;
  initialGoal: string | null;
  goalUpdatedAt: Date | null;
  placeholder: string;
  customLabels?: {
    header?: string | null;
    description?: string | null;
  };
}

export function ObjectiveGoalTab({
  objectiveId,
  initialGoal,
  goalUpdatedAt,
  placeholder,
  customLabels,
}: ObjectiveGoalTabProps) {
  return (
    <MarkdownEditorProvider
      id={objectiveId}
      initialContent={initialGoal}
      initialLastSaved={goalUpdatedAt}
      storageKey={`objective-goal-${objectiveId}`}
      saveAction={updateObjectiveGoalAction}
      placeholder={placeholder}
      maxLength={OBJECTIVE_FIELD_MAX_LENGTH}
    >
      <Card>
        <CardHeader>
          <CardTitle>{customLabels?.header || 'Objective Goal'}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {customLabels?.description ||
              'Details about this specific goal, deal, or project'}
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
