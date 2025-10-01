import { FileIcon } from './icons';
import { Button } from './ui/button';
import Link from 'next/link';

interface DocumentsEmptyStateProps {
  workspaceId: string;
}

export function DocumentsEmptyState({ workspaceId }: DocumentsEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center">
      <div className="mb-4 text-muted-foreground">
        <FileIcon size={48} />
      </div>
      <h2 className="text-xl font-semibold mb-2">
        No documents in your library yet
      </h2>
      <p className="text-muted-foreground mb-6 max-w-md">
        Create documents from your chats to build your AI assistant&apos;s
        knowledge base.
      </p>
      <Button asChild>
        <Link href={`/workspace/${workspaceId}`}>Go to Chats →</Link>
      </Button>
    </div>
  );
}
