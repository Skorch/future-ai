'use client';

import { useState } from 'react';
import { ScenarioSelector } from './scenario-selector';
import { ConfigurationPanel } from './configuration-panel';
import { PromptStackView } from './prompt-stack-view';
import { SCENARIOS, type ScenarioId } from '../types';
import type { Domain, ArtifactType } from '@/lib/db/schema';
import { updateDomainPrompt, updateArtifactTypePrompt } from '../actions';

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
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left column: Scenario and configuration */}
      <div className="lg:col-span-1 space-y-6">
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
      </div>

      {/* Right column: Prompt stack view */}
      <div className="lg:col-span-2">
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
    </div>
  );
}
