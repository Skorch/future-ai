'use client';

import { Button } from '@/components/ui/button';
import { Copy } from 'lucide-react';
import { toast } from 'sonner';

interface PromptActionsProps {
  fullPrompt: string;
}

export function PromptActions({ fullPrompt }: PromptActionsProps) {
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(fullPrompt);
      toast.success('Prompt copied to clipboard');
    } catch (error) {
      toast.error('Failed to copy prompt');
    }
  };

  return (
    <div className="flex gap-2">
      <Button onClick={handleCopy} variant="outline" size="sm">
        <Copy className="mr-2 size-4" />
        Copy Full Prompt
      </Button>
    </div>
  );
}
