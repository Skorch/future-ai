'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { ChevronDownIcon, BookOpenIcon } from 'lucide-react';

interface PlaybookResult {
  success: boolean;
  playbook?: {
    name: string;
    description: string | null;
    whenToUse: string;
    content: string;
    stepCount: number;
  };
  message?: string;
  error?: string;
}

interface PlaybookToolResultProps {
  result: PlaybookResult;
}

export function PlaybookToolResult({ result }: PlaybookToolResultProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (!result.success || !result.playbook) {
    return (
      <div className="not-prose mb-4 w-full rounded-md border p-3 bg-destructive/10 text-destructive">
        <div className="flex items-center gap-2">
          <BookOpenIcon className="size-4 shrink-0" />
          <span className="text-sm font-medium">
            {result.error || 'Failed to retrieve playbook'}
          </span>
        </div>
        {result.message && <div className="mt-2 text-sm">{result.message}</div>}
      </div>
    );
  }

  const { playbook } = result;

  return (
    <Collapsible
      className="not-prose mb-4 w-full rounded-md border"
      open={isOpen}
      onOpenChange={setIsOpen}
    >
      <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 p-3 min-w-0">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <BookOpenIcon className="size-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
          <span className="font-medium text-sm truncate">
            Retrieved Playbook
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge
            variant="secondary"
            className="rounded-full text-xs bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300"
          >
            {playbook.stepCount} steps
          </Badge>
          <ChevronDownIcon
            className={cn(
              'size-4 text-muted-foreground transition-transform',
              isOpen ? 'rotate-180' : 'rotate-0',
            )}
          />
        </div>
      </CollapsibleTrigger>

      <CollapsibleContent className="data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-top-2 data-[state=open]:slide-in-from-top-2 text-popover-foreground outline-none data-[state=closed]:animate-out data-[state=open]:animate-in">
        <div className="px-3 pb-3 space-y-3">
          {/* Playbook Header */}
          <div className="p-3 bg-indigo-50 dark:bg-indigo-900/10 rounded-md space-y-2">
            <div className="text-sm font-semibold text-indigo-900 dark:text-indigo-100">
              {playbook.name}
            </div>
            {playbook.description && (
              <div className="text-sm text-indigo-700 dark:text-indigo-300">
                {playbook.description}
              </div>
            )}
          </div>

          {/* When to Use */}
          <div className="p-3 bg-muted/50 rounded-md space-y-2">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              When to Use
            </div>
            <div className="text-sm">{playbook.whenToUse}</div>
          </div>

          {/* Steps Preview */}
          <div className="p-3 bg-muted/30 rounded-md">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
              Workflow Preview
            </div>
            <div className="text-sm text-muted-foreground">
              This playbook contains {playbook.stepCount} sequential steps to
              guide your workflow. The agent will follow these steps to ensure
              completeness and consistency.
            </div>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
