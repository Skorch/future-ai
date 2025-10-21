'use client';

import { useRouter } from 'next/navigation';
import { KnowledgeProvider } from '@/components/knowledge/providers/knowledge-provider';
import { EmptyStateContent } from './empty-state-content';

interface ObjectiveEmptyStateProps {
  workspaceId: string;
  objectiveId: string;
  onDismiss: () => void;
}

/**
 * ObjectiveEmptyState - Wrapper that provides knowledge creation logic
 *
 * Overrides the default onNavigate behavior to inject the New Objective
 * Playbook prompt when creating a summary.
 *
 * NAVIGATION OVERRIDE:
 * Instead of the default "Please load and create a summary..." prompt,
 * we inject a prompt that instructs the AI to use the New Objective Playbook.
 *
 * TODO: Replace placeholder with actual New Objective Playbook name once defined
 */
export function ObjectiveEmptyState({
  workspaceId,
  objectiveId,
  onDismiss,
}: ObjectiveEmptyStateProps) {
  const router = useRouter();

  const handleNavigate = (url: string) => {
    // Parse the URL to extract query params
    const urlObj = new URL(url, 'http://localhost'); // base doesn't matter, just parsing
    const queryParam = urlObj.searchParams.get('query');

    if (queryParam) {
      // Replace the default summary prompt with New Objective Playbook prompt
      // TODO: Update this to reference the actual playbook name once it's created
      const newObjectivePrompt =
        'Use the New Objective Playbook to help me get started with this objective based on the transcript I just uploaded.';

      const newQueryParam = encodeURIComponent(newObjectivePrompt);

      // Reconstruct URL with new query param
      const newUrl = `/workspace/${workspaceId}/chat/new?objectiveId=${objectiveId}&query=${newQueryParam}&autoSubmit=true`;

      router.push(newUrl);
      router.refresh();
    } else {
      // Fallback: just navigate to the URL as-is
      router.push(url);
      router.refresh();
    }
  };

  const handleClose = (didCreate: boolean) => {
    if (didCreate) {
      router.refresh();
    }
    // Note: We don't call onDismiss here because navigation will happen via handleNavigate
  };

  return (
    <KnowledgeProvider
      workspaceId={workspaceId}
      objectiveId={objectiveId}
      open={true} // Always "open" since this is a full-page takeover
      onClose={handleClose}
      onNavigate={handleNavigate}
    >
      <EmptyStateContent workspaceId={workspaceId} onDismiss={onDismiss} />
    </KnowledgeProvider>
  );
}
