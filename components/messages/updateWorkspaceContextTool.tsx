'use client';

import { Badge } from '@/components/ui/badge';
import {
  Tool,
  ToolHeader,
  ToolContent,
  ToolInput,
  ToolOutput,
} from '@/components/elements/tool';
import type { ToolUIPart } from 'ai';
import { useArtifact } from '@/hooks/use-artifact';

interface UpdateWorkspaceContextToolProps {
  toolCallId: string;
  state: ToolUIPart['state'];
  input?: unknown;
  streamingContent?: string;
  output?: {
    success?: boolean;
    updatedSections?: string[];
    error?: string;
  };
}

export function UpdateWorkspaceContextTool({
  toolCallId,
  state,
  input,
  streamingContent,
  output,
}: UpdateWorkspaceContextToolProps) {
  // Use category-based artifact to show streaming content
  const { artifact } = useArtifact('context');
  const isStreaming = artifact.status === 'streaming';
  const hasContent = artifact.content.length > 0;

  return (
    <Tool
      key={toolCallId}
      defaultOpen={isStreaming || state === 'input-available'}
    >
      <ToolHeader
        type="tool-updateWorkspaceContext"
        state={state}
        label="Updating Workspace Context"
      />
      <ToolContent>
        {state === 'input-available' && <ToolInput input={input} />}

        {/* Show streaming content preview */}
        {isStreaming && hasContent && (
          <div className="border-l-2 border-primary/50 pl-4 py-2 max-h-[300px] overflow-y-auto">
            <div className="text-xs font-medium text-muted-foreground mb-2">
              Generating context...
            </div>
            <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
              {artifact.content}
            </div>
          </div>
        )}
        {state === 'output-available' && (
          <ToolOutput
            output={
              output?.success ? (
                <div className="space-y-3">
                  <div className="text-sm text-muted-foreground">
                    Workspace context updated based on new observations
                  </div>
                  {output.updatedSections &&
                    Array.isArray(output.updatedSections) &&
                    output.updatedSections.length > 0 && (
                      <div className="space-y-1">
                        <div className="text-xs font-medium">
                          Updated sections:
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {output.updatedSections.map((section: string) => (
                            <Badge
                              key={section}
                              variant="secondary"
                              className="text-xs"
                            >
                              {section.replace(/([A-Z])/g, ' $1').trim()}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">
                  Context update completed
                </div>
              )
            }
            errorText={output?.error ? String(output.error) : undefined}
          />
        )}
      </ToolContent>
    </Tool>
  );
}
