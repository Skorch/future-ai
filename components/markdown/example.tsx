/**
 * Example usage of MarkdownEditor component
 *
 * This file demonstrates different configurations and use cases.
 * Not meant for production - just for testing and documentation.
 */

'use client';

import { useState } from 'react';
import { MarkdownEditor } from './markdown-editor';

/**
 * Basic usage example
 */
export function BasicMarkdownEditorExample() {
  const [content, setContent] = useState('# Hello World\n\nStart writing...');

  return (
    <div className="max-w-4xl mx-auto p-8">
      <h2 className="text-xl font-bold mb-4">Basic Editor</h2>
      <MarkdownEditor
        value={content}
        onChange={setContent}
        placeholder="Write something..."
      />
    </div>
  );
}

/**
 * With auto-save example
 */
export function AutoSaveMarkdownEditorExample() {
  const [content, setContent] = useState('');

  const handleSave = async (markdown: string) => {
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));
    // In real app: await fetch('/api/save', { method: 'POST', body: ... })
  };

  return (
    <div className="max-w-4xl mx-auto p-8">
      <h2 className="text-xl font-bold mb-4">Auto-Save Editor</h2>
      <MarkdownEditor
        value={content}
        onChange={setContent}
        onSave={handleSave}
        autoSave={true}
        saveDebounce={2000}
        storageKey="example-auto-save"
        placeholder="Type something and watch it auto-save..."
      />
    </div>
  );
}

/**
 * With character limit example
 */
export function CharacterLimitExample() {
  const [content, setContent] = useState(
    '# Character Limit Demo\n\nThis editor has a 500 character limit.',
  );

  return (
    <div className="max-w-4xl mx-auto p-8">
      <h2 className="text-xl font-bold mb-4">Character Limit Editor</h2>
      <MarkdownEditor
        value={content}
        onChange={setContent}
        maxLength={500}
        showCharacterCount={true}
        placeholder="Try typing or pasting more than 500 characters..."
      />
    </div>
  );
}

/**
 * Feature-limited example
 */
export function FeatureLimitedExample() {
  const [content, setContent] = useState(`# Basic Formatting Only

This editor only supports:
- Bold and italic text
- Headings
- Lists

Tables, tasks, and links are disabled.
`);

  return (
    <div className="max-w-4xl mx-auto p-8">
      <h2 className="text-xl font-bold mb-4">Limited Features Editor</h2>
      <MarkdownEditor
        value={content}
        onChange={setContent}
        features={['bold', 'italic', 'headings', 'lists']}
        placeholder="Only basic formatting available..."
      />
    </div>
  );
}

/**
 * Read-only example
 */
export function ReadOnlyExample() {
  const content = `# Read-Only Content

This content cannot be edited.

- Feature 1
- Feature 2
- Feature 3

**Note**: This is a read-only view.
`;

  return (
    <div className="max-w-4xl mx-auto p-8">
      <h2 className="text-xl font-bold mb-4">Read-Only Editor</h2>
      <MarkdownEditor
        value={content}
        readOnly={true}
        showCharacterCount={false}
        showToolbar={false}
      />
    </div>
  );
}

/**
 * Full-featured example with all options
 */
export function FullFeaturedExample() {
  const [content, setContent] = useState(`# Full-Featured Editor

This editor has **all** features enabled:

## Formatting

- **Bold text**
- *Italic text*
- \`inline code\`

## Lists

### Unordered
- Item 1
- Item 2
- Item 3

### Ordered
1. First
2. Second
3. Third

### Tasks
- [x] Completed task
- [ ] Pending task
- [ ] Another task

## Table

| Feature | Status |
|---------|--------|
| Tables | ✓ |
| Tasks | ✓ |
| Links | ✓ |
| Code | ✓ |

## Links

[Visit Example](https://example.com)

## Code Block

\`\`\`javascript
function hello() {
  console.log("Hello, world!");
}
\`\`\`
`);

  const handleSave = async (markdown: string) => {
    await new Promise((resolve) => setTimeout(resolve, 1000));
  };

  return (
    <div className="max-w-4xl mx-auto p-8">
      <h2 className="text-xl font-bold mb-4">Full-Featured Editor</h2>
      <MarkdownEditor
        value={content}
        onChange={setContent}
        onSave={handleSave}
        autoSave={true}
        maxLength={10000}
        showCharacterCount={true}
        showToolbar={true}
        toolbarMode="floating"
        storageKey="full-featured-example"
        placeholder="Try all the markdown features..."
      />
    </div>
  );
}
