import { Badge } from '@/components/ui/badge';
import {
  Tool,
  ToolHeader,
  ToolContent,
  ToolInput,
  ToolOutput,
} from '@/components/elements/tool';
import type { ToolUIPart } from 'ai';

interface UpdateObjectiveGoalToolProps {
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

export function UpdateObjectiveGoalTool({
  toolCallId,
  state,
  input,
  streamingContent,
  output,
}: UpdateObjectiveGoalToolProps) {
  return (
    <Tool key={toolCallId} defaultOpen={false}>
      <ToolHeader
        type="tool-updateObjectiveGoal"
        state={state}
        label="Updating Objective Goal"
      />
      <ToolContent>
        {state === 'input-available' && (
          <>
            <ToolInput input={input} />
            {streamingContent && (
              <div className="p-4 space-y-2 border-t">
                <h4 className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
                  Generating Goal
                </h4>
                <div className="prose prose-sm max-w-none text-sm whitespace-pre-wrap">
                  {streamingContent}
                </div>
              </div>
            )}
          </>
        )}
        {state === 'output-available' && (
          <ToolOutput
            output={
              output?.success ? (
                <div className="space-y-3">
                  <div className="text-sm text-muted-foreground">
                    Objective goal updated based on new observations
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
                  Goal update completed
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
