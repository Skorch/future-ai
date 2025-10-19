'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ScenarioSelector } from './scenario-selector';
import { ConfigurationPanel } from './configuration-panel';
import { PromptStackView, type PromptStackViewRef } from './prompt-stack-view';
import { SCENARIOS, type ScenarioId } from '../types';
import type { Domain, ArtifactType, User } from '@/lib/db/schema';
import { updateDomainPrompt, updateArtifactTypePrompt } from '../actions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';

interface PromptsPageClientProps {
  domains: Domain[];
  artifactTypes: ArtifactType[];
  user: User | null;
}

export function PromptsPageClient({
  domains,
  artifactTypes,
  user,
}: PromptsPageClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const stackViewRef = useRef<PromptStackViewRef>(null);

  // Initialize state from URL or defaults
  const [selectedScenarioId, setSelectedScenarioId] = useState<ScenarioId>(
    () => (searchParams.get('scenario') as ScenarioId) || 'chat-message',
  );
  const [selectedDomainId, setSelectedDomainId] = useState<string | null>(
    () => searchParams.get('domain') || domains[0]?.id || null,
  );
  const [selectedArtifactTypeId, setSelectedArtifactTypeId] = useState<
    string | null
  >(() => searchParams.get('artifactType') || null);
  const [configExpanded, setConfigExpanded] = useState(
    () => searchParams.get('configExpanded') !== 'false',
  );
  const [expandedLayers, setExpandedLayers] = useState<Set<string>>(() => {
    const expanded = searchParams.get('expanded');
    return expanded ? new Set(expanded.split(',')) : new Set();
  });

  const scenario = SCENARIOS.find((s) => s.id === selectedScenarioId);
  const domain = domains.find((d) => d.id === selectedDomainId) || null;
  const artifactType =
    artifactTypes.find((at) => at.id === selectedArtifactTypeId) || null;

  // Update URL whenever state changes
  useEffect(() => {
    const params = new URLSearchParams();
    params.set('scenario', selectedScenarioId);
    if (selectedDomainId) params.set('domain', selectedDomainId);
    if (selectedArtifactTypeId)
      params.set('artifactType', selectedArtifactTypeId);
    params.set('configExpanded', String(configExpanded));
    if (expandedLayers.size > 0) {
      params.set('expanded', Array.from(expandedLayers).join(','));
    }

    // Replace URL without triggering navigation
    router.replace(`?${params.toString()}`, { scroll: false });
  }, [
    selectedScenarioId,
    selectedDomainId,
    selectedArtifactTypeId,
    configExpanded,
    expandedLayers,
    router,
  ]);

  // Flush all saves before config changes
  const flushSaves = useCallback(async () => {
    if (stackViewRef.current) {
      try {
        await stackViewRef.current.saveAll();
      } catch (error) {
        toast.error('Failed to save changes');
        throw error; // Prevent config change if save fails
      }
    }
  }, []);

  // Handle scenario change with save-before-switch
  const handleScenarioChange = useCallback(
    async (scenarioId: ScenarioId) => {
      await flushSaves();
      setSelectedScenarioId(scenarioId);

      const newScenario = SCENARIOS.find((s) => s.id === scenarioId);

      // Auto-select first matching artifact type if scenario requires one
      if (newScenario?.requiresArtifactType && newScenario.artifactCategory) {
        const matchingType = artifactTypes.find(
          (at) => at.category === newScenario.artifactCategory,
        );
        setSelectedArtifactTypeId(matchingType?.id || null);
      }
    },
    [artifactTypes, flushSaves],
  );

  // Handle domain change with save-before-switch
  const handleDomainChange = useCallback(
    async (domainId: string) => {
      await flushSaves();
      setSelectedDomainId(domainId);
    },
    [flushSaves],
  );

  // Handle artifact type change with save-before-switch
  const handleArtifactTypeChange = useCallback(
    async (artifactTypeId: string) => {
      await flushSaves();
      setSelectedArtifactTypeId(artifactTypeId);
    },
    [flushSaves],
  );

  // Handle layer toggle
  const handleToggleLayer = useCallback((layerSource: string) => {
    setExpandedLayers((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(layerSource)) {
        newSet.delete(layerSource);
      } else {
        newSet.add(layerSource);
      }
      return newSet;
    });
  }, []);

  // Handle config panel toggle with save-before-collapse
  const handleConfigToggle = useCallback(async () => {
    if (configExpanded) {
      // Collapsing - save first
      await flushSaves();
    }
    setConfigExpanded(!configExpanded);
  }, [configExpanded, flushSaves]);

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
          onClick={handleConfigToggle}
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
              onDomainChange={handleDomainChange}
              onArtifactTypeChange={handleArtifactTypeChange}
            />
          </CardContent>
        )}
      </Card>

      {/* Prompt Stack View */}
      {domain ? (
        <PromptStackView
          ref={stackViewRef}
          scenario={scenario}
          domain={domain}
          artifactType={artifactType}
          user={user}
          expandedLayers={expandedLayers}
          onToggleLayer={handleToggleLayer}
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
