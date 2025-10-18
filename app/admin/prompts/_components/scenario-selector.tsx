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
  return (
    <div className="space-y-2">
      <div className="text-sm font-medium">Select Scenario</div>
      <Select value={selectedId} onValueChange={onSelect}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Choose a prompt scenario..." />
        </SelectTrigger>
        <SelectContent>
          {SCENARIOS.map((scenario) => (
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
