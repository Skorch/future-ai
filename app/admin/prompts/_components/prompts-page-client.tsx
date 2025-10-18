'use client';

import { useState } from 'react';
import { ScenarioSelector } from './scenario-selector';
import { ConfigurationPanel } from './configuration-panel';
import { PromptStackView } from './prompt-stack-view';
import { SCENARIOS, type ScenarioId } from '../types';
import type { Domain, ArtifactType } from '@/lib/db/schema';
import { updateDomainPrompt, updateArtifactTypePrompt } from '../actions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface PromptsPageClientProps {
  domains: Domain[];
  artifactTypes: ArtifactType[];
}

export function PromptsPageClient({
  domains,
  artifactTypes,
}: PromptsPageClientProps) {
  const [selectedScenarioId, setSelectedScenarioId] =
    useState<ScenarioId>('chat-message');
  const [selectedDomainId, setSelectedDomainId] = useState<string | null>(
    domains[0]?.id || null,
  );
  const [selectedArtifactTypeId, setSelectedArtifactTypeId] = useState<
    string | null
  >(null);
  const [configExpanded, setConfigExpanded] = useState(true);

  const scenario = SCENARIOS.find((s) => s.id === selectedScenarioId);
  const domain = domains.find((d) => d.id === selectedDomainId) || null;
  const artifactType =
    artifactTypes.find((at) => at.id === selectedArtifactTypeId) || null;

  // Auto-select artifact type when scenario changes (if scenario requires one)
  const handleScenarioChange = (scenarioId: ScenarioId) => {
    setSelectedScenarioId(scenarioId);
    const newScenario = SCENARIOS.find((s) => s.id === scenarioId);

    // Auto-select first matching artifact type if scenario requires one
    if (newScenario?.requiresArtifactType && newScenario.artifactCategory) {
      const matchingType = artifactTypes.find(
        (at) => at.category === newScenario.artifactCategory,
      );
      setSelectedArtifactTypeId(matchingType?.id || null);
    }
  };

  if (!scenario) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Error: Invalid scenario selected
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Collapsible Configuration Section */}
      <Card>
        <CardHeader
          className="cursor-pointer hover:bg-accent/50 transition-colors"
          onClick={() => setConfigExpanded(!configExpanded)}
        >
          <div className="flex items-center justify-between">
            <CardTitle>Configuration</CardTitle>
            <Button variant="ghost" size="sm">
              {configExpanded ? (
                <ChevronUp className="size-4" />
              ) : (
                <ChevronDown className="size-4" />
              )}
            </Button>
          </div>
        </CardHeader>
        {configExpanded && (
          <CardContent className="space-y-6">
            <ScenarioSelector
              selectedId={selectedScenarioId}
              onSelect={handleScenarioChange}
            />

            <ConfigurationPanel
              scenario={scenario}
              domains={domains}
              artifactTypes={artifactTypes}
              selectedDomainId={selectedDomainId}
              selectedArtifactTypeId={selectedArtifactTypeId}
              onDomainChange={setSelectedDomainId}
              onArtifactTypeChange={setSelectedArtifactTypeId}
            />
          </CardContent>
        )}
      </Card>

      {/* Prompt Stack View */}
      {domain ? (
        <PromptStackView
          scenario={scenario}
          domain={domain}
          artifactType={artifactType}
          onSaveDomain={updateDomainPrompt}
          onSaveArtifactType={updateArtifactTypePrompt}
        />
      ) : (
        <div className="text-center py-12 text-muted-foreground">
          Please select a domain to view prompts
        </div>
      )}
    </div>
  );
}
