'use client';

import { ThinkingBudget, OutputSize } from '@/lib/ai/types';

interface StreamConfigDisplayProps {
  // biome-ignore lint/suspicious/noExplicitAny: StreamText config can have various value types
  config: Record<string, any>;
  title?: string;
}

export function StreamConfigDisplay({
  config,
  title = 'StreamText Configuration',
}: StreamConfigDisplayProps) {
  // biome-ignore lint/suspicious/noExplicitAny: Function needs to handle values of any type
  const formatValue = (value: any): string => {
    if (value === undefined || value === null) {
      return 'default';
    }
    if (Array.isArray(value)) {
      return `[${value.length} items]`;
    }
    if (typeof value === 'object') {
      return JSON.stringify(value, null, 2);
    }
    if (typeof value === 'string') {
      return `"${value}"`;
    }
    return String(value);
  };

  const getThinkingBudgetLabel = (budget?: number): string => {
    if (!budget) return 'default';

    // Find the matching enum key for the value
    const enumKey = Object.entries(ThinkingBudget).find(
      ([key, value]) => typeof value === 'number' && value === budget,
    )?.[0];

    return enumKey ? `${budget} (${enumKey})` : String(budget);
  };

  const getMaxOutputTokensLabel = (tokens?: number): string => {
    if (!tokens) return 'default';

    // Find the matching enum key for the value
    const enumKey = Object.entries(OutputSize).find(
      ([key, value]) => typeof value === 'number' && value === tokens,
    )?.[0];

    return enumKey ? `${tokens} (${enumKey})` : String(tokens);
  };

  return (
    <div className="space-y-2 rounded-lg border p-4">
      <h3 className="font-semibold">{title}</h3>
      <div className="space-y-1 font-mono text-xs">
        <div>
          <span className="text-muted-foreground">model:</span>{' '}
          {formatValue(config.model)}
        </div>

        {config.temperature !== undefined && (
          <div>
            <span className="text-muted-foreground">temperature:</span>{' '}
            {formatValue(config.temperature)}
          </div>
        )}

        {config.thinkingBudget !== undefined && (
          <div>
            <span className="text-muted-foreground">thinkingBudget:</span>{' '}
            {getThinkingBudgetLabel(config.thinkingBudget)}
          </div>
        )}

        {config.maxOutputTokens !== undefined && (
          <div>
            <span className="text-muted-foreground">maxOutputTokens:</span>{' '}
            {getMaxOutputTokensLabel(config.maxOutputTokens)}
          </div>
        )}

        {config.activeTools && (
          <div>
            <span className="text-muted-foreground">
              experimental_activeTools:
            </span>{' '}
            [{config.activeTools.length} tools]
            <div className="ml-4 mt-1 grid grid-cols-3 gap-1">
              {config.activeTools.map((tool: string) => (
                <div key={tool} className="text-muted-foreground">
                  • {tool}
                </div>
              ))}
            </div>
          </div>
        )}

        {config.experimental_transform && (
          <div>
            <span className="text-muted-foreground">
              experimental_transform:
            </span>{' '}
            {formatValue(config.experimental_transform)}
          </div>
        )}

        {config.providerOptions && (
          <div>
            <span className="text-muted-foreground">providerOptions:</span>
            <pre className="ml-4 mt-1 text-muted-foreground">
              {formatValue(config.providerOptions)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
