'use client';

import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight, Copy } from 'lucide-react';
import { useState } from 'react';
import type { ToolDescription } from '@/lib/ai/prompts/assemblers';

interface ToolsDisplayProps {
  tools: ToolDescription[];
}

export function ToolsDisplay({ tools }: ToolsDisplayProps) {
  // Auto-expand all tools by default
  const [expandedTools, setExpandedTools] = useState<Set<string>>(() => {
    return new Set(tools.map((t) => t.name));
  });

  const toggleTool = (name: string) => {
    const newExpanded = new Set(expandedTools);
    if (newExpanded.has(name)) {
      newExpanded.delete(name);
    } else {
      newExpanded.add(name);
    }
    setExpandedTools(newExpanded);
  };

  const copyToolDescription = async (description: string) => {
    await navigator.clipboard.writeText(description);
  };

  return (
    <div className="space-y-2 rounded-lg border p-4">
      <h3 className="font-semibold">Tools ({tools.length})</h3>

      <div className="space-y-3">
        {tools.map((tool) => {
          const isExpanded = expandedTools.has(tool.name);

          return (
            <Collapsible
              key={tool.name}
              open={isExpanded}
              onOpenChange={() => toggleTool(tool.name)}
            >
              <div className="space-y-1.5 rounded border bg-muted/30 p-3">
                <div className="flex items-center justify-between">
                  <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium hover:underline">
                    {isExpanded ? (
                      <ChevronDown className="size-4" />
                    ) : (
                      <ChevronRight className="size-4" />
                    )}
                    {tool.name}
                    {tool.isActive ? (
                      <span className="ml-2 rounded bg-green-500/20 px-1.5 py-0.5 text-xs text-green-700 dark:text-green-300">
                        Active
                      </span>
                    ) : (
                      <span className="ml-2 rounded bg-gray-500/20 px-1.5 py-0.5 text-xs text-gray-600 dark:text-gray-400">
                        Inactive
                      </span>
                    )}
                  </CollapsibleTrigger>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => copyToolDescription(tool.description)}
                    className="h-7 px-2"
                  >
                    <Copy className="size-3" />
                  </Button>
                </div>

                {!isExpanded && (
                  <pre className="text-xs text-muted-foreground whitespace-pre-wrap">
                    {tool.description.slice(0, 200)}
                    {tool.description.length > 200 && '...'}
                  </pre>
                )}

                <CollapsibleContent>
                  <pre className="text-xs text-muted-foreground whitespace-pre-wrap">
                    {tool.description}
                  </pre>
                </CollapsibleContent>
              </div>
            </Collapsible>
          );
        })}
      </div>
    </div>
  );
}
