'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SCENARIOS, type ScenarioId } from '../types';

interface ScenarioSelectorProps {
  selectedId: ScenarioId;
  onSelect: (scenarioId: ScenarioId) => void;
}

export function ScenarioSelector({
  selectedId,
  onSelect,
}: ScenarioSelectorProps) {
  // Filter out chat-message scenario (shown on Main Agent tab)
  const toolScenarios = SCENARIOS.filter((s) => s.id !== 'chat-message');

  return (
    <div className="space-y-2">
      <div className="text-sm font-medium">Select Tool</div>
      <Select value={selectedId} onValueChange={onSelect}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Choose a tool..." />
        </SelectTrigger>
        <SelectContent>
          {toolScenarios.map((scenario) => (
            <SelectItem key={scenario.id} value={scenario.id}>
              <div className="flex flex-col">
                <span className="font-medium">{scenario.label}</span>
                <span className="text-xs text-muted-foreground">
                  {scenario.description}
                </span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
