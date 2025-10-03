'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight, Copy } from 'lucide-react';

interface PromptSection {
  title: string;
  content: string;
  collapsible?: boolean;
}

interface PromptPreviewProps {
  title: string;
  sections: PromptSection[];
  className?: string;
}

export function PromptPreview({
  title,
  sections,
  className = '',
}: PromptPreviewProps) {
  // Auto-expand all collapsible sections by default
  const [expandedSections, setExpandedSections] = useState<Set<string>>(() => {
    const initialExpanded = new Set<string>();
    sections.forEach((section) => {
      if (section.collapsible !== false) {
        initialExpanded.add(section.title);
      }
    });
    return initialExpanded;
  });

  const toggleSection = (title: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(title)) {
      newExpanded.delete(title);
    } else {
      newExpanded.add(title);
    }
    setExpandedSections(newExpanded);
  };

  const copySection = async (content: string) => {
    await navigator.clipboard.writeText(content);
  };

  return (
    <div className={`space-y-2 rounded-lg border p-4 ${className}`}>
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">{title}</h3>
      </div>

      <div className="space-y-3">
        {sections.map((section) => {
          const isExpanded = expandedSections.has(section.title);
          const isCollapsible = section.collapsible !== false;

          if (!isCollapsible) {
            return (
              <div
                key={section.title}
                className="space-y-1.5 rounded border bg-muted/30 p-3"
              >
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium">{section.title}</h4>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => copySection(section.content)}
                    className="h-7 px-2"
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
                <pre className="text-xs text-muted-foreground whitespace-pre-wrap">
                  {section.content}
                </pre>
              </div>
            );
          }

          return (
            <Collapsible
              key={section.title}
              open={isExpanded}
              onOpenChange={() => toggleSection(section.title)}
            >
              <div className="space-y-1.5 rounded border bg-muted/30 p-3">
                <div className="flex items-center justify-between">
                  <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium hover:underline">
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                    {section.title}
                  </CollapsibleTrigger>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => copySection(section.content)}
                    className="h-7 px-2"
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>

                {!isExpanded && (
                  <pre className="text-xs text-muted-foreground whitespace-pre-wrap">
                    {section.content.slice(0, 200)}
                    {section.content.length > 200 && '...'}
                  </pre>
                )}

                <CollapsibleContent>
                  <pre className="text-xs text-muted-foreground whitespace-pre-wrap">
                    {section.content}
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
