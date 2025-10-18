'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { countTokens } from '@/lib/utils/token-counter';

interface LayerTokenInfo {
  label: string;
  content: string;
}

interface TokenCounterProps {
  layers: LayerTokenInfo[];
}

export function TokenCounter({ layers }: TokenCounterProps) {
  const layerCounts = layers.map((layer) => ({
    label: layer.label,
    tokens: countTokens(layer.content),
  }));

  const totalTokens = layerCounts.reduce((sum, layer) => sum + layer.tokens, 0);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Token Usage</CardTitle>
          <div className="text-lg font-semibold">
            {totalTokens.toLocaleString()} tokens
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {layerCounts.map((layer) => (
            <div
              key={layer.label}
              className="flex items-center justify-between text-sm"
            >
              <span className="text-muted-foreground">{layer.label}</span>
              <span className="font-mono">{layer.tokens.toLocaleString()}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
