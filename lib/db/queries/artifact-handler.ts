import 'server-only';

import { generateText, type UIMessageStreamWriter } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import type { ArtifactType } from '../schema';
import type { ChatMessage } from '@/lib/types';

/**
 * Generate document content from database-driven ArtifactType definition
 *
 * This replaces the hardcoded artifact registry with a fully dynamic system
 * that uses the ArtifactType table for prompts and templates.
 */
export async function generateFromArtifactType(
  artifactType: ArtifactType,
  context: {
    sourceContent?: string;
    instruction?: string;
    model?: string;
    dataStream?: UIMessageStreamWriter<ChatMessage>;
    onChunk?: (text: string) => void;
  },
): Promise<string> {
  const {
    sourceContent = '',
    instruction,
    model = 'claude-sonnet-4-20250514',
    dataStream,
    onChunk,
  } = context;

  // Build the generation prompt
  const prompt = buildGenerationPrompt({
    sourceContent,
    instruction,
    template: artifactType.template,
  });

  // Note: dataStream is for metadata (data-kind, data-id, etc.), not text streaming
  // We use generateText for simplicity since text streaming via UIMessageStreamWriter
  // requires a different approach (the parent tool handles artifact stream writes)
  const { text } = await generateText({
    model: anthropic(model),
    system: artifactType.instructionPrompt,
    prompt,
  });

  // Call onChunk callback if provided (for custom streaming handlers)
  if (onChunk) {
    onChunk(text);
  }

  return text;
}

/**
 * Build the generation prompt from context and template
 */
function buildGenerationPrompt(params: {
  sourceContent?: string;
  instruction?: string;
  template?: string | null;
}): string {
  const { sourceContent, instruction, template } = params;

  const parts: string[] = [];

  if (sourceContent) {
    parts.push(`## Source Content\n\n${sourceContent}`);
  }

  if (instruction) {
    parts.push(`## Additional Instructions\n\n${instruction}`);
  }

  if (template) {
    parts.push(`## Expected Output Template\n\n${template}`);
    parts.push(
      '\nGenerate the document following the template structure above.',
    );
  } else {
    parts.push('\nGenerate appropriate content for this document type.');
  }

  return parts.join('\n\n');
}

/**
 * Validate that an artifact type is suitable for document generation
 */
export function validateArtifactTypeForGeneration(
  artifactType: ArtifactType | null | undefined,
):
  | { valid: true; artifactType: ArtifactType }
  | { valid: false; error: string } {
  if (!artifactType) {
    return { valid: false, error: 'No artifact type provided' };
  }

  if (!artifactType.instructionPrompt) {
    return {
      valid: false,
      error: `Artifact type "${artifactType.label}" has no instruction prompt configured`,
    };
  }

  // Context artifacts typically don't have templates (they're more free-form)
  // Only objective artifacts require templates
  if (artifactType.category === 'objective' && !artifactType.template) {
    return {
      valid: false,
      error: `Objective artifact type "${artifactType.label}" requires a template`,
    };
  }

  return { valid: true, artifactType };
}
