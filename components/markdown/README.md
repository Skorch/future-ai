# MarkdownEditor Component

A flexible, feature-rich markdown editor built with TipTap and React.

## Features

- **Full Markdown Support**: Write and edit markdown with live preview
- **Auto-Save**: Configurable debounced saving to prevent data loss
- **LocalStorage Backup**: Automatic backup of unsaved changes
- **Character Limits**: Enforced character limits with visual warnings
- **Paste Truncation**: Smart paste handling that truncates to fit limits
- **Configurable Extensions**: Enable/disable features like tables, task lists, links
- **Read-Only Mode**: Display markdown content without editing
- **Accessibility**: Full ARIA support and keyboard navigation
- **TypeScript**: Fully typed with comprehensive prop interfaces

## Installation

The following TipTap extensions are required (already installed):

```bash
pnpm add @tiptap/react @tiptap/starter-kit @tiptap/pm
pnpm add @tiptap/extension-placeholder
pnpm add @tiptap/extension-link
pnpm add @tiptap/extension-task-list @tiptap/extension-task-item
pnpm add @tiptap/extension-table @tiptap/extension-table-row
pnpm add @tiptap/extension-table-header @tiptap/extension-table-cell
pnpm add tiptap-markdown
```

## Basic Usage

```tsx
import { MarkdownEditor } from '@/components/markdown';

function MyComponent() {
  const [content, setContent] = useState('# Hello World');

  return (
    <MarkdownEditor
      value={content}
      onChange={setContent}
      placeholder="Start writing..."
    />
  );
}
```

## With Auto-Save

```tsx
import { MarkdownEditor } from '@/components/markdown';

function MyComponent() {
  const [content, setContent] = useState('');

  const handleSave = async (markdown: string) => {
    // Save to server
    await fetch('/api/save', {
      method: 'POST',
      body: JSON.stringify({ content: markdown }),
    });
  };

  return (
    <MarkdownEditor
      value={content}
      onChange={setContent}
      onSave={handleSave}
      autoSave={true}
      saveDebounce={2000} // Save 2 seconds after last change
      storageKey="my-editor-backup" // LocalStorage key for backup
    />
  );
}
```

## With Character Limits

```tsx
<MarkdownEditor
  value={content}
  onChange={setContent}
  maxLength={5000}
  showCharacterCount={true}
/>
```

## Feature Configuration

Control which editor features are enabled:

```tsx
<MarkdownEditor
  value={content}
  onChange={setContent}
  features={['bold', 'italic', 'headings', 'lists']}
  // Disables tables, tasks, and links
/>
```

Available features:
- `'all'` - Enable all features (default)
- `'tables'` - Table support
- `'tasks'` - Task list checkboxes
- `'links'` - Link handling
- `'bold'` - Bold text
- `'italic'` - Italic text
- `'code'` - Code blocks and inline code
- `'headings'` - Headings (H1-H6)
- `'lists'` - Bullet and ordered lists

## Read-Only Mode

```tsx
<MarkdownEditor
  value={content}
  readOnly={true}
  showCharacterCount={false}
/>
```

## Props

### Required Props

| Prop | Type | Description |
|------|------|-------------|
| `value` | `string` | Current markdown content |

### Optional Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `onChange` | `(content: string) => void` | - | Called when content changes |
| `onSave` | `(content: string) => Promise<void>` | - | Called when save is triggered |
| `placeholder` | `string` | `''` | Placeholder text when empty |
| `maxLength` | `number` | `50000` | Maximum character length |
| `showToolbar` | `boolean` | `true` | Show formatting toolbar |
| `toolbarMode` | `'floating' \| 'inline' \| 'none'` | `'floating'` | Toolbar display mode |
| `autoSave` | `boolean` | `true` | Enable auto-save |
| `saveDebounce` | `number` | `2000` | Auto-save delay (ms) |
| `showCharacterCount` | `boolean` | `true` | Show character counter |
| `features` | `MarkdownEditorFeature[]` | `['all']` | Enabled features |
| `className` | `string` | - | Additional CSS classes |
| `readOnly` | `boolean` | `false` | Make editor read-only |
| `storageKey` | `string` | - | LocalStorage backup key |
| `ariaLabel` | `string` | `'Markdown editor'` | ARIA label |

## Save Status Indicators

The component automatically shows save status when `autoSave` and `onSave` are enabled:

- **Saving...** - Save in progress
- **Saved at [time]** - Successfully saved
- **Failed to save** - Error occurred

## LocalStorage Backup

When a `storageKey` is provided, the editor automatically:
1. Saves changes to localStorage immediately (no debounce)
2. Clears the backup after successful server save
3. Shows an indicator when unsaved changes exist

This prevents data loss if the user closes the browser or loses connection.

## Character Limit Behavior

- Warning color when 95% of limit is reached
- Error color when at limit
- Paste operations are automatically truncated to fit
- User receives toast notifications for truncation

## Accessibility

The editor includes:
- Configurable ARIA labels
- Keyboard navigation support
- Screen reader compatibility
- Focus management

## Styling

The editor uses Tailwind CSS classes and respects dark mode:

```tsx
<MarkdownEditor
  value={content}
  onChange={setContent}
  className="border-2 border-primary rounded-lg"
/>
```

The editor content has `prose` styling by default for clean markdown rendering.

## Future Enhancements

- **Toolbar Implementation**: Visual toolbar for formatting (floating/inline modes)
- **Image Upload**: Drag-and-drop image support
- **Collaboration**: Real-time collaborative editing
- **Version History**: Track and restore previous versions
- **Export**: Export to PDF, HTML, or other formats

## Related Components

- See `/components/markdown-editor/providers/markdown-editor-provider.tsx` for the original provider-based pattern
- Toolbar components coming soon in `/components/markdown/toolbar/`

## Example

See the component in action:

```tsx
import { useState } from 'react';
import { MarkdownEditor } from '@/components/markdown';

export function ExampleEditor() {
  const [content, setContent] = useState(`# My Document

This is a **markdown** editor with *all* the features.

## Features

- Auto-save
- Character limits
- Task lists
- Tables
- And more!

## Task List

- [x] Completed task
- [ ] Pending task

## Table

| Feature | Status |
|---------|--------|
| Tables | ✓ |
| Tasks | ✓ |
| Links | ✓ |
`);

  return (
    <div className="max-w-4xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-4">Markdown Editor Demo</h1>
      <MarkdownEditor
        value={content}
        onChange={setContent}
        onSave={async (markdown) => {
          // Simulate save
          console.log('Saving:', markdown);
          await new Promise(resolve => setTimeout(resolve, 1000));
        }}
        placeholder="Start writing your markdown here..."
        maxLength={10000}
        storageKey="demo-editor"
      />
    </div>
  );
}
```
