'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MarkdownEditor } from '@/components/markdown';
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
  const [content, setContent] = useState(initialGoal || '');

  /**
   * Adapter function to convert the action signature
   * from: (id, content) => Promise<undefined | { error: string }>
   * to: (content) => Promise<void>
   */
  const handleSave = async (newContent: string): Promise<void> => {
    const result = await updateObjectiveGoalAction(objectiveId, newContent);
    if (result?.error) {
      throw new Error(result.error);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{customLabels?.header || 'Objective Goal'}</CardTitle>
        <p className="text-sm text-muted-foreground">
          {customLabels?.description ||
            'Details about this specific goal, deal, or project'}
        </p>
      </CardHeader>
      <CardContent>
        <MarkdownEditor
          value={content}
          onChange={setContent}
          onSave={handleSave}
          placeholder={placeholder}
          maxLength={OBJECTIVE_FIELD_MAX_LENGTH}
          storageKey={`objective-goal-${objectiveId}`}
          autoSave={true}
          showCharacterCount={true}
          ariaLabel="Objective goal editor"
        />
      </CardContent>
    </Card>
  );
}
