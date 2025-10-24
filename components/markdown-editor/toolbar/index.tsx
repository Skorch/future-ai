/**
 * Markdown Editor Toolbar Components
 *
 * Provides floating and inline toolbar components for the TipTap markdown editor.
 *
 * ## Components
 *
 * - **FloatingToolbar**: Appears when text is selected (uses BubbleMenu)
 * - **InlineToolbar**: Fixed toolbar at top of editor
 * - **ToolbarButton**: Reusable button component
 *
 * ## Features
 *
 * - Responsive design (desktop vs mobile button sets)
 * - Active state indication
 * - Accessible with aria-labels
 * - Customizable button collections
 *
 * ## Usage
 *
 * ```tsx
 * import { FloatingToolbar, InlineToolbar } from '@/components/markdown-editor/toolbar';
 * import { useMarkdownEditor } from '@/components/markdown-editor/providers/markdown-editor-provider';
 *
 * function MyEditor() {
 *   const { editor } = useMarkdownEditor();
 *
 *   return (
 *     <>
 *       <InlineToolbar editor={editor} />
 *       <FloatingToolbar editor={editor} />
 *       <EditorContent editor={editor} />
 *     </>
 *   );
 * }
 * ```
 */

export {
  FloatingToolbar,
  FloatingToolbarMinimal,
} from './floating-toolbar';

export {
  InlineToolbar,
  InlineToolbarMinimal,
  InlineToolbarCompact,
} from './inline-toolbar';

export {
  ToolbarButton,
  ToolbarSeparator,
  // Button configs
  boldButton,
  italicButton,
  strikeButton,
  heading1Button,
  heading2Button,
  heading3Button,
  bulletListButton,
  orderedListButton,
  taskListButton,
  codeButton,
  codeBlockButton,
  linkButton,
  tableButton,
  undoButton,
  redoButton,
  clearFormattingButton,
  // Button collections
  allButtons,
  essentialButtons,
  // Types
  type ToolbarButtonConfig,
} from './toolbar-buttons';
