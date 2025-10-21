# Markdown Editor Provider

A React composition provider that consolidates shared Tiptap editor logic across multiple editor tabs.

## Features

- **Tiptap Editor Setup**: Pre-configured with Markdown, StarterKit, and Placeholder extensions
- **LocalStorage Backup**: Instant backup on every change
- **Debounced Server Save**: Saves to server after 2 seconds of inactivity
- **Character Limit Enforcement**: Configurable max length with automatic truncation
- **Paste Truncation**: Intelligently handles pasting content that exceeds limits
- **Toast Notifications**: User feedback for save success/error states
- **TypeScript**: Fully typed with exported interfaces

## Usage

### Basic Example

```tsx
import { MarkdownEditorProvider, useMarkdownEditor } from '@/components/markdown-editor/providers';
import { EditorContent } from '@tiptap/react';
import { updateObjectiveGoalAction } from '@/lib/objective/actions';

function MyEditorTab() {
  return (
    <MarkdownEditorProvider
      id="objective-123"
      initialContent="# My Goal"
      initialLastSaved={new Date()}
      storageKey="objective-goal-objective-123"
      saveAction={updateObjectiveGoalAction}
      placeholder="Enter your goal..."
    >
      <EditorUI />
    </MarkdownEditorProvider>
  );
}

function EditorUI() {
  const { editor, isSaving, lastSaved, characterCount, maxLength, isWarning, isAtLimit } = useMarkdownEditor();

  if (!editor) return null;

  return (
    <div>
      <EditorContent editor={editor} />
      <div className="text-xs text-muted-foreground">
        {isSaving ? 'Saving...' : `Last saved: ${lastSaved?.toLocaleTimeString()}`}
      </div>
      <div className={isAtLimit ? 'text-red-500' : isWarning ? 'text-amber-500' : ''}>
        {characterCount.toLocaleString()} / {maxLength.toLocaleString()} characters
      </div>
    </div>
  );
}
```

### Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `children` | `ReactNode` | ✅ | - | Child components (typically your UI) |
| `id` | `string` | ✅ | - | Objective or workspace ID |
| `initialContent` | `string \| null` | ✅ | - | Initial markdown content |
| `initialLastSaved` | `Date \| null` | ✅ | - | Initial last saved timestamp |
| `storageKey` | `string` | ✅ | - | LocalStorage key (e.g., `"objective-goal-{id}"`) |
| `saveAction` | `(id: string, content: string) => Promise<void \| { error: string }>` | ✅ | - | Server action to save content |
| `placeholder` | `string` | ❌ | `''` | Placeholder text for empty editor |
| `maxLength` | `number` | ❌ | `5000` | Maximum character limit |
| `warningThreshold` | `number` | ❌ | `0.95` | Warning threshold (95% of maxLength) |
| `onSaveSuccess` | `() => void` | ❌ | - | Callback on successful save |
| `onSaveError` | `(error: Error) => void` | ❌ | - | Callback on save error |
| `ariaLabel` | `string` | ❌ | `'Markdown editor'` | Accessibility label |

### Context Value

The `useMarkdownEditor()` hook returns:

```typescript
interface MarkdownEditorContext {
  editor: Editor | null;          // Tiptap editor instance
  content: string;                 // Current markdown content
  isSaving: boolean;               // Is save in progress
  lastSaved: Date | null;          // Last successful save timestamp
  characterCount: number;          // Current character count
  maxLength: number;               // Maximum allowed characters
  warningThreshold: number;        // Calculated warning threshold count
  isWarning: boolean;              // Is above warning threshold
  isAtLimit: boolean;              // Is at or above limit
}
```

### Save Action Types

The provider supports two save action signatures:

**1. Void return (throws on error):**
```typescript
async (id: string, content: string): Promise<void> => {
  await updateObjectiveGoalAction(id, content);
}
```

**2. Error object return:**
```typescript
async (id: string, content: string): Promise<{ error: string } | void> => {
  const result = await updateWorkspaceContextAction(id, content);
  if (result.error) {
    return { error: result.error };
  }
}
```

## Architecture Decisions

### Why a Provider?

Three nearly identical editor tabs (240 lines each) shared 95% of their logic:
- `objective-goal-tab.tsx`
- `objective-actions-tab.tsx`
- `workspace-context-tab.tsx`

The provider consolidates:
1. Tiptap editor configuration
2. LocalStorage backup logic
3. Debounced server save
4. Character limit enforcement
5. Paste truncation handling
6. Toast notifications

### What's NOT in the Provider?

Following pragmatic architecture principles, the provider:
- ❌ Does NOT render UI components (Card, CardHeader, etc.)
- ❌ Does NOT include custom labels or descriptions
- ❌ Does NOT dictate layout or styling
- ✅ ONLY handles business logic and state management

This allows consuming components to:
- Customize their UI freely
- Add tab-specific features
- Maintain their own styling
- Use different layouts

## Migration Path

### Current Pattern (240 lines)
```tsx
export function ObjectiveGoalTab({ objectiveId, initialGoal, ... }) {
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(...);
  // ... 200+ lines of shared logic
  return <Card>...</Card>;
}
```

### New Pattern (~50 lines)
```tsx
export function ObjectiveGoalTab({ objectiveId, initialGoal, ... }) {
  return (
    <MarkdownEditorProvider
      id={objectiveId}
      initialContent={initialGoal}
      storageKey={`objective-goal-${objectiveId}`}
      saveAction={updateObjectiveGoalAction}
      placeholder="Enter goal..."
    >
      <ObjectiveGoalUI />
    </MarkdownEditorProvider>
  );
}

function ObjectiveGoalUI() {
  const { editor, isSaving, lastSaved, ... } = useMarkdownEditor();
  return <Card>...</Card>;
}
```

## References

- Original implementations:
  - `/components/objective/objective-goal-tab.tsx`
  - `/components/objective/objective-actions-tab.tsx`
  - `/components/workspace/workspace-context-tab.tsx`
- Constants: `/lib/objective/constants.ts`
- Utilities: `/lib/utils/debounce.ts`
