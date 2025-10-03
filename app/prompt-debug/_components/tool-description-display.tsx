'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface ToolDescriptionDisplayProps {
  description: string;
}

export function ToolDescriptionDisplay({
  description,
}: ToolDescriptionDisplayProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="space-y-2 rounded-lg border p-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">
          Tool: createDocument (dynamic description)
        </h3>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setIsExpanded(!isExpanded)}
          className="h-7 px-2"
        >
          {isExpanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </Button>
      </div>

      {!isExpanded && (
        <pre className="text-xs text-muted-foreground whitespace-pre-wrap">
          {description.slice(0, 150)}...
        </pre>
      )}

      {isExpanded && (
        <pre className="max-h-96 overflow-auto text-xs text-muted-foreground whitespace-pre-wrap">
          {description}
        </pre>
      )}
    </div>
  );
}
