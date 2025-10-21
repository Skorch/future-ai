'use client';

import { Loader2Icon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useKnowledge } from '@/components/knowledge/primitives';

/**
 * StartObjectiveButton - CTA for empty state
 *
 * Always creates a summary (summarize=true) since new objectives
 * should always launch with the New Objective Playbook.
 */
export function StartObjectiveButton() {
  const { createDocument, isValid, isSubmitting, submittingAction } =
    useKnowledge();

  const isLoading = isSubmitting && submittingAction === 'summarize';

  return (
    <Button
      size="lg"
      onClick={() => createDocument(true)}
      disabled={!isValid || isSubmitting}
      className="min-w-[280px]"
    >
      {isLoading ? (
        <>
          <Loader2Icon className="mr-2 size-4 animate-spin" />
          Creating your objective...
        </>
      ) : (
        '🚀 Start with this transcript'
      )}
    </Button>
  );
}
