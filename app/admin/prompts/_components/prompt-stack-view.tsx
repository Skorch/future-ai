'use client';

import { useState, useMemo } from 'react';
import { PromptLayerEditor } from './prompt-layer-editor';
import { TokenCounter } from './token-counter';
import { PromptActions } from './prompt-actions';
import type { Scenario } from '../types';
import type { Domain, ArtifactType } from '@/lib/db/schema';
import {
  SYSTEM_PROMPT_BASE,
  PLAYBOOK_GUIDANCE,
} from '@/lib/ai/prompts/builders/shared/prompts/system.prompts';
import { getUnifiedAgentPrompt } from '@/lib/ai/prompts/builders/shared/prompts/unified-agent.prompts';

interface PromptStackViewProps {
  scenario: Scenario;
  domain: Domain | null;
  artifactType: ArtifactType | null;
  workspace?: { context: string | null } | null;
  objective?: { context: string | null } | null;
  onSaveDomain?: (domainId: string, systemPrompt: string) => Promise<void>;
  onSaveArtifactType?: (
    artifactTypeId: string,
    data: { instructionPrompt?: string; template?: string },
  ) => Promise<void>;
}

export function PromptStackView({
  scenario,
  domain,
  artifactType,
  workspace,
  objective,
  onSaveDomain,
  onSaveArtifactType,
}: PromptStackViewProps) {
  const [expandedLayers, setExpandedLayers] = useState<Set<string>>(new Set()); // Start with all layers collapsed

  const toggleLayer = (layerSource: string) => {
    setExpandedLayers((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(layerSource)) {
        newSet.delete(layerSource);
      } else {
        newSet.add(layerSource);
      }
      return newSet;
    });
  };

  // Compose layer content from various sources
  const layers = useMemo(() => {
    return scenario.layers.map((layerConfig) => {
      let content = '';
      const editable = layerConfig.editable;
      let onSave: ((content: string) => Promise<void>) | undefined;

      switch (layerConfig.source) {
        case 'base':
          content = SYSTEM_PROMPT_BASE;
          break;
        case 'playbook':
          content = PLAYBOOK_GUIDANCE;
          break;
        case 'domain':
          content = domain?.systemPrompt || '';
          if (editable && domain && onSaveDomain) {
            onSave = async (newContent: string) => {
              await onSaveDomain(domain.id, newContent);
            };
          }
          break;
        case 'unified':
          content = getUnifiedAgentPrompt();
          break;
        case 'artifactType':
          content = artifactType?.instructionPrompt || '';
          if (editable && artifactType && onSaveArtifactType) {
            onSave = async (newContent: string) => {
              await onSaveArtifactType(artifactType.id, {
                instructionPrompt: newContent,
              });
            };
          }
          break;
        case 'template':
          content = artifactType?.template || '';
          if (editable && artifactType && onSaveArtifactType) {
            onSave = async (newContent: string) => {
              await onSaveArtifactType(artifactType.id, {
                template: newContent,
              });
            };
          }
          break;
        case 'workspaceContext':
          content = workspace?.context || '';
          break;
        case 'objectiveContext':
          content = objective?.context || '';
          break;
        default:
          content = '';
      }

      return {
        ...layerConfig,
        content,
        onSave: onSave || (async () => {}), // No-op if not editable
      };
    });
  }, [
    scenario,
    domain,
    artifactType,
    workspace,
    objective,
    onSaveDomain,
    onSaveArtifactType,
  ]);

  // Compose full prompt for copying
  const fullPrompt = useMemo(() => {
    return layers
      .map((layer) => layer.content)
      .filter(Boolean)
      .join('\n\n---\n\n');
  }, [layers]);

  // Prepare token counter data
  const tokenCounterLayers = useMemo(() => {
    return layers.map((layer) => ({
      label: layer.label,
      content: layer.content,
    }));
  }, [layers]);

  return (
    <div className="space-y-4">
      {/* Token Counter */}
      <TokenCounter layers={tokenCounterLayers} />

      {/* Prompt Actions */}
      <PromptActions fullPrompt={fullPrompt} />

      {/* Layer Editors */}
      <div className="space-y-3">
        {layers.map((layer) => (
          <PromptLayerEditor
            key={layer.source}
            label={layer.label}
            dbField={layer.dbField}
            content={layer.content}
            editable={layer.editable}
            expanded={expandedLayers.has(layer.source)}
            onToggle={() => toggleLayer(layer.source)}
            onSave={layer.onSave}
          />
        ))}
      </div>
    </div>
  );
}
