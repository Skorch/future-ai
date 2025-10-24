# Markdown Editor Toolbar Components

Floating and inline toolbar components for the TipTap markdown editor with responsive design.

## Components

### FloatingToolbar

Appears when text is selected using TipTap's `BubbleMenu` component.

**Features:**
- Auto-positioning near text selection
- Desktop: All formatting buttons (Bold, Italic, Strike, H1-H3, Code, Link, Clear formatting)
- Mobile: Essential buttons only (Bold, Italic, H1, Code)

```tsx
import { FloatingToolbar } from '@/components/markdown-editor/toolbar';
import { useMarkdownEditor } from '@/components/markdown-editor/providers/markdown-editor-provider';

function MyEditor() {
  const { editor } = useMarkdownEditor();
  return <FloatingToolbar editor={editor} />;
}
```

**Variants:**
- `<FloatingToolbar />` - Full feature set
- `<FloatingToolbarMinimal />` - Essential buttons only

### InlineToolbar

Fixed toolbar at the top of the editor.

**Features:**
- Desktop: All buttons (Bold, Italic, Strike, H1-H3, Lists, Code blocks, Links, Tables, Undo/Redo, Clear formatting)
- Mobile: Essential buttons only (Bold, Italic, H1, Bullet list, Code)
- Grouped by function with separators
- Undo/Redo buttons are disabled when not applicable

```tsx
import { InlineToolbar } from '@/components/markdown-editor/toolbar';
import { useMarkdownEditor } from '@/components/markdown-editor/providers/markdown-editor-provider';

function MyEditor() {
  const { editor } = useMarkdownEditor();
  return <InlineToolbar editor={editor} />;
}
```

**Variants:**
- `<InlineToolbar />` - Full feature set
- `<InlineToolbarMinimal />` - Essential buttons only
- `<InlineToolbarCompact />` - No tables/task lists

## Button Configurations

All buttons are exported as reusable configurations:

```tsx
import {
  boldButton,
  italicButton,
  heading1Button,
  type ToolbarButtonConfig,
} from '@/components/markdown-editor/toolbar';

// Create custom toolbar
const customButtons: ToolbarButtonConfig[] = [
  boldButton,
  italicButton,
  heading1Button,
];

<InlineToolbar editor={editor} buttons={customButtons} />
```

### Available Buttons

| Button | Key | Desktop | Mobile |
|--------|-----|---------|--------|
| Bold | `boldButton` | ✓ | ✓ |
| Italic | `italicButton` | ✓ | ✓ |
| Strikethrough | `strikeButton` | ✓ | - |
| Heading 1 | `heading1Button` | ✓ | ✓ |
| Heading 2 | `heading2Button` | ✓ | - |
| Heading 3 | `heading3Button` | ✓ | - |
| Bullet List | `bulletListButton` | ✓ | ✓ |
| Ordered List | `orderedListButton` | ✓ | - |
| Task List | `taskListButton` | ✓ | - |
| Inline Code | `codeButton` | ✓ | ✓ |
| Code Block | `codeBlockButton` | ✓ | - |
| Link | `linkButton` | ✓ | - |
| Table | `tableButton` | ✓ | - |
| Undo | `undoButton` | ✓ | - |
| Redo | `redoButton` | ✓ | - |
| Clear Formatting | `clearFormattingButton` | ✓ | - |

## Complete Example

```tsx
import { EditorContent } from '@tiptap/react';
import {
  MarkdownEditorProvider,
  useMarkdownEditor
} from '@/components/markdown-editor/providers/markdown-editor-provider';
import {
  InlineToolbar,
  FloatingToolbar
} from '@/components/markdown-editor/toolbar';

function EditorWithToolbars() {
  const { editor } = useMarkdownEditor();

  return (
    <div className="border rounded-md">
      <InlineToolbar editor={editor} />
      <FloatingToolbar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
}

function MyPage() {
  return (
    <MarkdownEditorProvider
      id="my-doc"
      initialContent="# Hello World"
      initialLastSaved={null}
      storageKey="my-doc-content"
      saveAction={async (id, content) => {
        // Save to server
        return undefined; // or { error: 'message' }
      }}
      placeholder="Start typing..."
    >
      <EditorWithToolbars />
    </MarkdownEditorProvider>
  );
}
```

## Responsive Behavior

The toolbars automatically adapt to screen size:

- **Desktop (>768px)**: All features visible
- **Mobile (≤768px)**: Only essential buttons (Bold, Italic, H1, Bullet list, Code)

This is handled via Tailwind's `md:` breakpoint classes.

## Customization

### Custom Button Set

```tsx
import { InlineToolbar, boldButton, italicButton } from '@/components/markdown-editor/toolbar';

const myButtons = [boldButton, italicButton];

<InlineToolbar editor={editor} buttons={myButtons} />
```

### Custom Button

```tsx
import type { ToolbarButtonConfig } from '@/components/markdown-editor/toolbar';
import { Highlighter } from 'lucide-react';

const highlightButton: ToolbarButtonConfig = {
  key: 'highlight',
  icon: <Highlighter className="size-4" />,
  label: 'Highlight',
  isActive: (editor) => editor.isActive('highlight'),
  onClick: (editor) => editor.chain().focus().toggleHighlight().run(),
  desktop: true, // Only show on desktop
};
```

## Accessibility

All buttons include:
- `aria-label` attributes for screen readers
- Active state indication via background color
- Keyboard navigation support
- Disabled state for undo/redo when not applicable

## Dependencies

The toolbar components require:
- `@tiptap/react` (BubbleMenu)
- `@tiptap/starter-kit` (core formatting)
- `@tiptap/extension-table` (table support)
- `@tiptap/extension-task-list` & `@tiptap/extension-task-item` (task lists)
- `lucide-react` (icons)
- `@/components/ui/button` (button component)

All extensions are automatically configured in `MarkdownEditorProvider`.
