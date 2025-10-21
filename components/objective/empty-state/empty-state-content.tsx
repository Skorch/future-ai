'use client';

import { ArrowLeftIcon, XIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  KnowledgeInput,
  KnowledgeUploadButton,
} from '@/components/knowledge/primitives';
import { StartObjectiveButton } from './start-objective-button';

interface EmptyStateContentProps {
  workspaceId: string;
  onDismiss: () => void;
}

/**
 * EmptyStateContent - Full-page takeover for new objective onboarding
 *
 * Fixed positioning, centers the knowledge input flow, and provides
 * clear navigation options (back to workspace or skip).
 */
export function EmptyStateContent({
  workspaceId,
  onDismiss,
}: EmptyStateContentProps) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      {/* Header with navigation */}
      <header className="border-b">
        <div className="container flex h-14 items-center justify-between px-4">
          <Button variant="ghost" size="sm" asChild>
            <a href={`/workspace/${workspaceId}`}>
              <ArrowLeftIcon className="mr-2 size-4" />
              Back to Workspace
            </a>
          </Button>

          <Button variant="ghost" size="sm" onClick={onDismiss}>
            <XIcon className="mr-2 size-4" />
            Skip
          </Button>
        </div>
      </header>

      {/* Centered content */}
      <main className="container flex flex-1 flex-col items-center justify-center px-4 pb-20">
        <div className="w-full max-w-2xl space-y-8">
          {/* Title */}
          <div className="text-center">
            <h1 className="text-3xl font-bold tracking-tight">
              🎯 Start Your Objective
            </h1>
            <p className="mt-2 text-muted-foreground">
              Upload a transcript or paste content to kickstart your objective
              with AI-powered insights.
            </p>
          </div>

          {/* Knowledge input area */}
          <div className="space-y-6">
            {/* Large textarea using KnowledgeInput primitive */}
            <div className="[&_textarea]:min-h-[200px]">
              <KnowledgeInput />
            </div>

            {/* OR divider */}
            <div className="relative">
              <Separator />
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-background px-3">
                <span className="text-sm font-medium text-muted-foreground">
                  OR
                </span>
              </div>
            </div>

            {/* Upload button */}
            <KnowledgeUploadButton />

            {/* CTA button */}
            <div className="flex justify-center pt-4">
              <StartObjectiveButton />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
