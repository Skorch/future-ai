import { generateObject } from 'ai';
import { z } from 'zod';
import { myProvider } from '@/lib/ai/providers';
import { getLogger } from '@/lib/logger';

const logger = getLogger('GenerateTitle');

export interface GenerateTitleOptions {
  context: Record<string, string | number | boolean | string[]>;
  systemPrompt: string;
  userPrompt: string;
  maxOutputTokens?: number;
  temperature?: number;
  maxLength?: number;
}

/**
 * Template interpolation helper
 * Replaces {variable} placeholders with values from context
 * Arrays are joined with newlines
 */
function interpolate(
  template: string,
  vars: Record<string, string | number | boolean | string[]>,
): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => {
    const value = vars[key];
    if (Array.isArray(value)) {
      return value.join('\n');
    }
    return String(value ?? '');
  });
}

/**
 * Generate AI-powered titles using claude-3-5-haiku-latest
 *
 * Uses template interpolation for prompts with {variable} syntax
 * Supports rich context and configurable generation parameters
 *
 * @example
 * const title = await generateTitle({
 *   context: { objectiveTitle: 'Build feature', documentType: 'spec' },
 *   systemPrompt: 'Generate a document title. Max {maxLength} chars.',
 *   userPrompt: 'Objective: {objectiveTitle}\nType: {documentType}',
 *   maxLength: 80
 * });
 */
export async function generateTitle({
  context,
  systemPrompt,
  userPrompt,
  maxOutputTokens = 100,
  temperature = 0.3,
  maxLength = 80,
}: GenerateTitleOptions): Promise<string> {
  try {
    const interpolatedSystem = interpolate(systemPrompt, {
      ...context,
      maxLength,
    });
    const interpolatedUser = interpolate(userPrompt, context);

    logger.debug('Generating title', {
      systemPromptLength: interpolatedSystem.length,
      userPromptLength: interpolatedUser.length,
      maxOutputTokens,
      temperature,
    });

    // Use generateObject to enforce structured output (no conversational text)
    const schema = z.object({
      text: z.string().max(maxLength),
    });

    const { object } = await generateObject({
      model: myProvider.languageModel('title-model'), // claude-3-5-haiku-latest
      schema,
      mode: 'json',
      system: interpolatedSystem,
      prompt: interpolatedUser,
      temperature,
    });

    const trimmed = object.text.trim();

    logger.debug('Title generated', {
      length: trimmed.length,
      preview: trimmed.slice(0, 50),
    });

    return trimmed;
  } catch (error) {
    logger.error('Title generation failed', error);
    throw error;
  }
}
