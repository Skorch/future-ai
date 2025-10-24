'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MarkdownEditor } from '@/components/markdown';
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
  const [content, setContent] = useState(initialActions || '');

  /**
   * Adapter function to convert the action signature
   * from: (id, content) => Promise<undefined | { error: string }>
   * to: (content) => Promise<void>
   */
  const handleSave = async (newContent: string): Promise<void> => {
    const result = await updateObjectiveActionsAction(objectiveId, newContent);
    if (result?.error) {
      throw new Error(result.error);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{customLabels?.header || 'Objective Actions'}</CardTitle>
        <p className="text-sm text-muted-foreground">
          {customLabels?.description ||
            'Track action items, risks, and blockers for this objective'}
        </p>
      </CardHeader>
      <CardContent>
        <MarkdownEditor
          value={content}
          onChange={setContent}
          onSave={handleSave}
          placeholder={placeholder}
          maxLength={OBJECTIVE_FIELD_MAX_LENGTH}
          storageKey={`objective-actions-${objectiveId}`}
          autoSave={true}
          showCharacterCount={true}
          ariaLabel="Objective actions editor"
        />
      </CardContent>
    </Card>
  );
}
