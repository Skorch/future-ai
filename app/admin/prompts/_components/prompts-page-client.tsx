'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ScenarioSelector } from './scenario-selector';
import { ConfigurationPanel } from './configuration-panel';
import { PromptStackView, type PromptStackViewRef } from './prompt-stack-view';
import { PromptTabs } from '@/components/admin/prompt-tabs';
import { SCENARIOS, type ScenarioId } from '../types';
import type { Domain, ArtifactType, User } from '@/lib/db/schema';
import { updateDomainPrompt, updateArtifactTypePrompt } from '../actions';
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
  const [activeTab, setActiveTab] = useState<'main-agent' | 'tool-calls'>(
    () =>
      (searchParams.get('tab') as 'main-agent' | 'tool-calls') || 'main-agent',
  );
  const [selectedScenarioId, setSelectedScenarioId] = useState<ScenarioId>(
    () => {
      const urlScenario = searchParams.get('scenario') as ScenarioId;
      const urlTab = searchParams.get('tab') as 'main-agent' | 'tool-calls';

      // Main Agent tab always uses chat-message
      if (urlTab === 'main-agent' || !urlTab) {
        return 'chat-message';
      }

      // Tool Calls tab: use URL scenario or default to first non-chat scenario
      return urlScenario && urlScenario !== 'chat-message'
        ? urlScenario
        : 'workspace-context';
    },
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
    params.set('tab', activeTab);
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
    activeTab,
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

  // Handle tab change with save-before-switch
  const handleTabChange = useCallback(
    async (tab: 'main-agent' | 'tool-calls') => {
      await flushSaves();
      setActiveTab(tab);

      // When switching to "Main Agent" tab, always show chat-message scenario
      if (tab === 'main-agent') {
        setSelectedScenarioId('chat-message');
      } else {
        // When switching to Tool Calls tab, switch to first tool scenario if on chat-message
        if (selectedScenarioId === 'chat-message') {
          setSelectedScenarioId('workspace-context');
        }
      }
    },
    [flushSaves, selectedScenarioId],
  );

  if (!scenario) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Error: Invalid scenario selected
      </div>
    );
  }

  return (
    <PromptTabs activeTab={activeTab} onTabChange={handleTabChange}>
      <div className="space-y-8">
        {/* Collapsible Configuration Section */}
        <div className="border rounded-lg">
          <div
            role="button"
            tabIndex={0}
            className="flex items-center justify-between p-6 cursor-pointer hover:bg-accent/50 transition-colors"
            onClick={handleConfigToggle}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleConfigToggle();
              }
            }}
          >
            <h2 className="text-lg font-semibold">Configuration</h2>
            <Button variant="ghost" size="sm">
              {configExpanded ? (
                <ChevronUp className="size-4" />
              ) : (
                <ChevronDown className="size-4" />
              )}
            </Button>
          </div>
          {configExpanded && (
            <div className="p-6 space-y-6 border-t">
              {/* Only show scenario selector on Tool Calls tab */}
              {activeTab === 'tool-calls' && (
                <ScenarioSelector
                  selectedId={selectedScenarioId}
                  onSelect={handleScenarioChange}
                />
              )}

              <ConfigurationPanel
                scenario={scenario}
                domains={domains}
                artifactTypes={artifactTypes}
                selectedDomainId={selectedDomainId}
                selectedArtifactTypeId={selectedArtifactTypeId}
                onDomainChange={handleDomainChange}
                onArtifactTypeChange={handleArtifactTypeChange}
              />
            </div>
          )}
        </div>

        {/* Content area: Show PromptStackView for both tabs */}
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
    </PromptTabs>
  );
}
