'use client';

import { useRouter } from 'next/navigation';
import { KnowledgeProvider } from '@/components/knowledge/providers/knowledge-provider';
import { EmptyStateContent } from './empty-state-content';

interface ObjectiveEmptyStateProps {
  workspaceId: string;
  objectiveId: string;
  onDismiss: () => void;
}

interface Document {
  id: string;
  title: string;
}

/**
 * ObjectiveEmptyState - Full-page takeover for new objective initialization
 *
 * Handles document creation and navigation to chat with New Objective Playbook prompt.
 * When user creates a document with summarize=true, navigates to chat with custom prompt.
 */
export function ObjectiveEmptyState({
  workspaceId,
  objectiveId,
  onDismiss,
}: ObjectiveEmptyStateProps) {
  const router = useRouter();

  const handleClose = (document?: Document, summaryRequested?: boolean) => {
    // Always dismiss the empty state first
    onDismiss();

    if (document && summaryRequested) {
      // Navigate to chat with New Objective Playbook prompt
      const prompt = `Use the New Objective Playbook to help me get started with this objective based on the document "${document.title}" I just uploaded.`;
      const url = `/workspace/${workspaceId}/chat/new?objectiveId=${objectiveId}&query=${encodeURIComponent(prompt)}&autoSubmit=true`;
      router.push(url);
    }
    // If document created without summary, just dismiss (no navigation needed)
    // If user cancelled (no document), just dismiss
  };

  return (
    <KnowledgeProvider
      workspaceId={workspaceId}
      objectiveId={objectiveId}
      onClose={handleClose}
    >
      <EmptyStateContent
        workspaceId={workspaceId}
        onClose={() => handleClose()}
      />
    </KnowledgeProvider>
  );
}
