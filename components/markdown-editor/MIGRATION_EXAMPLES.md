# Migration Examples

This document shows how to refactor the existing editor tabs to use `MarkdownEditorProvider`.

## Example 1: Objective Goal Tab

### Before (240 lines)
```tsx
// components/objective/objective-goal-tab.tsx
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import TiptapStarterKit from '@tiptap/starter-kit';
import { Markdown } from 'tiptap-markdown';
import Placeholder from '@tiptap/extension-placeholder';
import { useLocalStorage } from 'usehooks-ts';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { updateObjectiveGoalAction } from '@/lib/objective/actions';
import { debounce } from '@/lib/utils/debounce';
import {
  OBJECTIVE_FIELD_MAX_LENGTH,
  OBJECTIVE_FIELD_WARNING_THRESHOLD,
} from '@/lib/objective/constants';

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
  goalUpdatedAt: initialGoalUpdatedAt,
  placeholder,
  customLabels,
}: ObjectiveGoalTabProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(initialGoalUpdatedAt);
  // ... 200+ lines of editor setup, save logic, character counting

  return (
    <Card>
      <CardHeader>
        <CardTitle>{customLabels?.header || 'Objective Goal'}</CardTitle>
        <p className="text-sm text-muted-foreground">
          {customLabels?.description || 'Details about this specific goal...'}
        </p>
      </CardHeader>
      <CardContent>
        <div className="border rounded-lg bg-background">
          <EditorContent editor={editor} />
        </div>
        {/* Status and character count UI */}
      </CardContent>
    </Card>
  );
}
```

### After (~80 lines)
```tsx
// components/objective/objective-goal-tab.tsx
'use client';

import { EditorContent } from '@tiptap/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MarkdownEditorProvider, useMarkdownEditor } from '@/components/markdown-editor/providers';
import { updateObjectiveGoalAction } from '@/lib/objective/actions';

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
      ariaLabel="Objective goal editor"
    >
      <ObjectiveGoalUI customLabels={customLabels} />
    </MarkdownEditorProvider>
  );
}

function ObjectiveGoalUI({
  customLabels,
}: {
  customLabels?: { header?: string | null; description?: string | null };
}) {
  const {
    editor,
    isSaving,
    lastSaved,
    characterCount,
    maxLength,
    isWarning,
    isAtLimit,
  } = useMarkdownEditor();

  if (!editor) return null;

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
        <div className="border rounded-lg bg-background">
          <EditorContent editor={editor} />
        </div>
        <div className="mt-2 flex justify-between text-xs text-muted-foreground">
          <div>
            {isSaving ? (
              <span>Saving...</span>
            ) : lastSaved ? (
              <span>Last saved: {lastSaved.toLocaleTimeString()}</span>
            ) : (
              <span>No changes yet</span>
            )}
          </div>
          <div
            className={
              isAtLimit
                ? 'text-red-500 font-bold'
                : isWarning
                  ? 'text-amber-500 font-medium'
                  : ''
            }
          >
            {characterCount.toLocaleString()} /{' '}
            {maxLength.toLocaleString()} characters
          </div>
        </div>
        {isAtLimit && (
          <p className="mt-2 text-xs text-red-500">
            Character limit reached. Please remove text before adding more.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
```

**Savings**: 240 lines → ~80 lines (67% reduction)

---

## Example 2: Workspace Context Tab

### Key Differences from Objective Tabs

The workspace context tab has two unique characteristics:
1. Uses a different character limit (5000 vs OBJECTIVE_FIELD_MAX_LENGTH)
2. Save action returns `{ error: string }` instead of throwing

### After Migration
```tsx
// components/workspace/workspace-context-tab.tsx
'use client';

import { EditorContent } from '@tiptap/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MarkdownEditorProvider, useMarkdownEditor } from '@/components/markdown-editor/providers';
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
      maxLength={5000}  // Custom limit!
      warningThreshold={0.95}  // 95% of 5000 = 4750
    >
      <WorkspaceContextUI customLabels={customLabels} />
    </MarkdownEditorProvider>
  );
}

function WorkspaceContextUI({
  customLabels,
}: {
  customLabels?: { header?: string | null; description?: string | null };
}) {
  const {
    editor,
    isSaving,
    lastSaved,
    characterCount,
    maxLength,
    isWarning,
    isAtLimit,
  } = useMarkdownEditor();

  if (!editor) return null;

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
        <div className="border rounded-lg bg-background">
          <EditorContent editor={editor} />
        </div>
        <div className="mt-2 flex justify-between text-xs text-muted-foreground">
          <div>
            {isSaving ? (
              <span>Saving...</span>
            ) : lastSaved ? (
              <span>Last saved: {lastSaved.toLocaleTimeString()}</span>
            ) : (
              <span>No changes yet</span>
            )}
          </div>
          <div
            className={
              isAtLimit
                ? 'text-red-500 font-bold'
                : isWarning
                  ? 'text-amber-500 font-medium'
                  : ''
            }
          >
            {characterCount.toLocaleString()} / 5,000 characters
          </div>
        </div>
        {isAtLimit && (
          <p className="mt-2 text-xs text-red-500">
            Character limit reached. Please remove text before adding more.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
```

**Key Points**:
- `maxLength={5000}` overrides the default
- `saveAction={updateWorkspaceContextAction}` works seamlessly because the provider handles both void and error-returning actions
- UI is identical except for the hardcoded "5,000 characters" display

---

## Example 3: Objective Actions Tab

### After Migration
```tsx
// components/objective/objective-actions-tab.tsx
'use client';

import { EditorContent } from '@tiptap/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MarkdownEditorProvider, useMarkdownEditor } from '@/components/markdown-editor/providers';
import { updateObjectiveActionsAction } from '@/lib/objective/actions';

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
      ariaLabel="Objective actions editor"
    >
      <ObjectiveActionsUI customLabels={customLabels} />
    </MarkdownEditorProvider>
  );
}

function ObjectiveActionsUI({
  customLabels,
}: {
  customLabels?: { header?: string | null; description?: string | null };
}) {
  const {
    editor,
    isSaving,
    lastSaved,
    characterCount,
    maxLength,
    isWarning,
    isAtLimit,
  } = useMarkdownEditor();

  if (!editor) return null;

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
        <div className="border rounded-lg bg-background">
          <EditorContent editor={editor} />
        </div>
        <div className="mt-2 flex justify-between text-xs text-muted-foreground">
          <div>
            {isSaving ? (
              <span>Saving...</span>
            ) : lastSaved ? (
              <span>Last saved: {lastSaved.toLocaleTimeString()}</span>
            ) : (
              <span>No changes yet</span>
            )}
          </div>
          <div
            className={
              isAtLimit
                ? 'text-red-500 font-bold'
                : isWarning
                  ? 'text-amber-500 font-medium'
                  : ''
            }
          >
            {characterCount.toLocaleString()} /{' '}
            {maxLength.toLocaleString()} characters
          </div>
        </div>
        {isAtLimit && (
          <p className="mt-2 text-xs text-red-500">
            Character limit reached. Please remove text before adding more.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
```

---

## Summary

### Total Code Reduction
- **Before**: 3 files × 240 lines = 720 lines
- **After**: 1 provider (300 lines) + 3 files × 80 lines = 540 lines
- **Savings**: 180 lines (25% reduction)

### Benefits Beyond Line Count
1. **Single Source of Truth**: Editor logic changes in one place
2. **Testability**: Provider can be unit tested independently
3. **Consistency**: All editors behave identically
4. **Maintainability**: Bug fixes apply to all editors
5. **Flexibility**: Easy to add new editor tabs

### Migration Checklist

For each tab file:
- [ ] Import `MarkdownEditorProvider` and `useMarkdownEditor`
- [ ] Remove all useState, useEffect, useCallback, useMemo hooks
- [ ] Remove editor setup, save logic, character counting
- [ ] Wrap return with `<MarkdownEditorProvider>`
- [ ] Create separate UI component that uses `useMarkdownEditor()`
- [ ] Pass only UI-specific props to UI component
- [ ] Verify toast messages still appear correctly
- [ ] Test LocalStorage backup behavior
- [ ] Test character limit enforcement
- [ ] Test paste truncation
