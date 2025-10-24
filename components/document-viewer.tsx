import { MarkdownViewer } from '@/components/markdown/markdown-viewer';

interface DocumentViewerProps {
  content: string;
}

export function DocumentViewer({ content }: DocumentViewerProps) {
  return <MarkdownViewer content={content} className="p-6" />;
}
