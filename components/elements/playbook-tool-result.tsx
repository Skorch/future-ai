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
    steps?: Array<{
      sequence: number;
      instruction: string;
    }>;
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
  const steps = playbook.steps || [];

  return (
    <Collapsible
      className="not-prose mb-4 w-full rounded-md border"
      open={isOpen}
      onOpenChange={setIsOpen}
    >
      <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 p-3 min-w-0">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <BookOpenIcon className="size-4 text-primary shrink-0" />
          <span className="font-medium text-sm truncate">
            Retrieved Playbook
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge variant="secondary" className="rounded-full text-xs">
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
          <div className="p-3 bg-accent/10 rounded-md space-y-2">
            <div className="text-sm font-semibold">{playbook.name}</div>
            {playbook.description && (
              <div className="text-sm text-muted-foreground">
                {playbook.description}
              </div>
            )}
          </div>

          {/* Steps List */}
          <div className="space-y-3">
            {steps.map((step) => (
              <div
                key={step.sequence}
                className="p-3 bg-muted/30 rounded-md border-l-2 border-primary"
              >
                <div className="text-xs font-semibold text-primary mb-1">
                  Step {step.sequence}
                </div>
                <div className="text-sm whitespace-pre-wrap">
                  {step.instruction}
                </div>
              </div>
            ))}
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
