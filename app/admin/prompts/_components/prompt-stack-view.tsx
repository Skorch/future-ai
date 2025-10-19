'use client';

import { useMemo, useRef, forwardRef, useImperativeHandle } from 'react';
import {
  PromptLayerEditor,
  type PromptLayerEditorRef,
} from './prompt-layer-editor';
import { TokenCounter } from './token-counter';
import { PromptActions } from './prompt-actions';
import type { Scenario } from '../types';
import type { Domain, ArtifactType, User } from '@/lib/db/schema';
import { CORE_SYSTEM_PROMPT } from '@/lib/ai/prompts/system';
import { getStreamingAgentPrompt } from '@/lib/ai/prompts/builders/shared/prompts/unified-agent.prompts';
import { getCurrentContext } from '@/lib/ai/prompts/current-context';

interface PromptStackViewProps {
  scenario: Scenario;
  domain: Domain | null;
  artifactType: ArtifactType | null;
  user: User | null;
  workspace?: { context: string | null } | null;
  objective?: { context: string | null } | null;
  expandedLayers: Set<string>;
  onToggleLayer: (layerSource: string) => void;
  onSaveDomain?: (domainId: string, systemPrompt: string) => Promise<void>;
  onSaveArtifactType?: (
    artifactTypeId: string,
    data: { instructionPrompt?: string; template?: string },
  ) => Promise<void>;
}

export interface PromptStackViewRef {
  saveAll: () => Promise<void>;
}

export const PromptStackView = forwardRef<
  PromptStackViewRef,
  PromptStackViewProps
>(function PromptStackView(
  {
    scenario,
    domain,
    artifactType,
    user,
    workspace,
    objective,
    expandedLayers,
    onToggleLayer,
    onSaveDomain,
    onSaveArtifactType,
  },
  ref,
) {
  // Create refs for all layer editors
  const editorRefs = useRef<Map<string, PromptLayerEditorRef>>(new Map());

  // Compose layer content from various sources
  const layers = useMemo(() => {
    return scenario.layers.map((layerConfig) => {
      let content = '';
      const editable = layerConfig.editable;
      let onSave: ((content: string) => Promise<void>) | undefined;

      switch (layerConfig.source) {
        case 'core':
          content = CORE_SYSTEM_PROMPT;
          break;
        case 'currentContext':
          content = getCurrentContext({ user });
          break;
        case 'domain':
          content = domain?.systemPrompt || '';
          if (editable && domain && onSaveDomain) {
            onSave = async (newContent: string) => {
              await onSaveDomain(domain.id, newContent);
            };
          }
          break;
        case 'streaming':
          content = getStreamingAgentPrompt();
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
    user,
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

  // Expose saveAll method to flush all pending saves
  useImperativeHandle(ref, () => ({
    saveAll: async () => {
      const savePromises: Promise<void>[] = [];
      editorRefs.current.forEach((editorRef) => {
        if (editorRef) {
          savePromises.push(editorRef.saveNow());
        }
      });
      await Promise.all(savePromises);
    },
  }));

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
            ref={(el) => {
              if (el) {
                editorRefs.current.set(layer.source, el);
              } else {
                editorRefs.current.delete(layer.source);
              }
            }}
            label={layer.label}
            dbField={layer.dbField}
            content={layer.content}
            editable={layer.editable}
            expanded={expandedLayers.has(layer.source)}
            onToggle={() => onToggleLayer(layer.source)}
            onSave={layer.onSave}
          />
        ))}
      </div>
    </div>
  );
});
