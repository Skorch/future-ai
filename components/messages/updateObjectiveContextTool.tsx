import { Badge } from '@/components/ui/badge';
import {
  Tool,
  ToolHeader,
  ToolContent,
  ToolInput,
  ToolOutput,
} from '@/components/elements/tool';
import type { ToolUIPart } from 'ai';

interface UpdateObjectiveContextToolProps {
  toolCallId: string;
  state: ToolUIPart['state'];
  input?: unknown;
  output?: {
    success?: boolean;
    updatedSections?: string[];
    error?: string;
  };
}

export function UpdateObjectiveContextTool({
  toolCallId,
  state,
  input,
  output,
}: UpdateObjectiveContextToolProps) {
  return (
    <Tool key={toolCallId} defaultOpen={false}>
      <ToolHeader type="tool-updateObjectiveContext" state={state} />
      <ToolContent>
        {state === 'input-available' && <ToolInput input={input} />}
        {state === 'output-available' && (
          <ToolOutput
            output={
              output?.success ? (
                <div className="space-y-3">
                  <div className="text-sm text-muted-foreground">
                    Objective context updated based on new observations
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
