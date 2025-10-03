'use client';

import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import type { DomainId } from '@/lib/domains';
import type { ChatMode } from '@/lib/db/schema';

export interface AgentConfig {
  domain: DomainId;
  mode: ChatMode;
  isComplete: boolean;
  goal: string;
  messageCount: number;
  todoCount: number;
}

interface AgentConfigFormProps {
  config: AgentConfig;
  onChange: (config: AgentConfig) => void;
}

export function AgentConfigForm({ config, onChange }: AgentConfigFormProps) {
  return (
    <div className="space-y-4 rounded-lg border p-4">
      <h3 className="font-semibold">Configuration</h3>

      {/* Domain Selection */}
      <div className="space-y-2">
        <Label>Domain</Label>
        <div className="flex gap-4">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="domain"
              value="sales"
              checked={config.domain === 'sales'}
              onChange={(e) =>
                onChange({ ...config, domain: e.target.value as DomainId })
              }
              className="h-4 w-4"
            />
            <span>Sales</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="domain"
              value="meeting"
              checked={config.domain === 'meeting'}
              onChange={(e) =>
                onChange({ ...config, domain: e.target.value as DomainId })
              }
              className="h-4 w-4"
            />
            <span>Meeting</span>
          </label>
        </div>
      </div>

      {/* Mode Selection */}
      <div className="space-y-2">
        <Label>Mode</Label>
        <div className="flex gap-4">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="mode"
              value="discovery"
              checked={config.mode === 'discovery'}
              onChange={(e) =>
                onChange({ ...config, mode: e.target.value as ChatMode })
              }
              className="h-4 w-4"
            />
            <span>Discovery</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="mode"
              value="build"
              checked={config.mode === 'build'}
              onChange={(e) =>
                onChange({ ...config, mode: e.target.value as ChatMode })
              }
              className="h-4 w-4"
            />
            <span>Build</span>
          </label>
        </div>
      </div>

      {/* Complete Toggle */}
      <div className="flex items-center justify-between">
        <Label htmlFor="complete-toggle">Mark task as complete</Label>
        <Switch
          id="complete-toggle"
          checked={config.isComplete}
          onCheckedChange={(checked) =>
            onChange({ ...config, isComplete: checked })
          }
        />
      </div>

      {/* Mode Context */}
      <div className="space-y-3 border-t pt-3">
        <h4 className="text-sm font-medium">Mode Context</h4>

        <div className="space-y-1.5">
          <Label htmlFor="goal">Goal</Label>
          <Input
            id="goal"
            value={config.goal}
            onChange={(e) => onChange({ ...config, goal: e.target.value })}
            placeholder="Analyze Q4 pipeline health"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="messageCount">Message Count</Label>
            <Input
              id="messageCount"
              type="number"
              value={config.messageCount}
              onChange={(e) =>
                onChange({
                  ...config,
                  messageCount: Number.parseInt(e.target.value, 10) || 0,
                })
              }
              min={0}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="todoCount">Todo Count</Label>
            <Input
              id="todoCount"
              type="number"
              value={config.todoCount}
              onChange={(e) =>
                onChange({
                  ...config,
                  todoCount: Number.parseInt(e.target.value, 10) || 0,
                })
              }
              min={0}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
