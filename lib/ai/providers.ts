import { getLogger } from '@/lib/logger';

const logger = getLogger('providers');
import type { LanguageModel } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { chatModels } from './models';

// Create Anthropic provider instance - lazy initialization to ensure env vars are loaded
let anthropicInstance: ReturnType<typeof createAnthropic> | null = null;

const getAnthropic = () => {
  if (!anthropicInstance) {
    logger.info(
      '[Providers] Initializing Anthropic with API key:',
      process.env.ANTHROPIC_API_KEY ? 'present' : 'missing',
    );

    // Get timeout from env variable, default to 10 minutes if not set
    const timeoutMs = process.env.ANTHROPIC_TIMEOUT_MS
      ? Number.parseInt(process.env.ANTHROPIC_TIMEOUT_MS, 10)
      : 600000; // Default: 10 minutes (600 seconds)

    const timeoutSeconds = Math.round(timeoutMs / 1000);
    logger.info(
      '[Providers] Anthropic timeout configured:',
      `${timeoutSeconds} seconds (${timeoutMs}ms)`,
    );

    anthropicInstance = createAnthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
      // Configure custom fetch with extended timeout to prevent 60-second undici default timeout
      // Default is 10 minutes, but can be configured via ANTHROPIC_TIMEOUT_MS env variable
      fetch: (url, options = {}) => {
        logger.info(
          `[Providers] Anthropic fetch initiated with ${timeoutSeconds}-second timeout`,
        );
        return fetch(url, {
          ...options,
          signal: AbortSignal.timeout(timeoutMs),
        });
      },
    });
  }
  return anthropicInstance;
};

// Build language models from our model definitions
const buildLanguageModels = () => {
  // biome-ignore lint/suspicious/noExplicitAny: Language models have varying types
  const models: Record<string, any> = {};

  // Debug: Check if API key is available
  if (!process.env.ANTHROPIC_API_KEY) {
    logger.warn(
      '[Providers] WARNING: ANTHROPIC_API_KEY is not set in environment variables',
    );
  }

  // Add all chat models from models.ts (all Anthropic now)
  for (const model of chatModels) {
    // All models use the same initialization - reasoning is handled via prompt/system message
    models[model.id] = getAnthropic()(model.anthropicModelId);
  }

  // Add title and artifact models using Claude
  // Using Haiku for title generation (fast and cheap)
  models['title-model'] = getAnthropic()('claude-3-5-haiku-latest');
  // Using Sonnet 4 for reranking (reliable structured outputs)
  models['reranker-model'] = getAnthropic()('claude-sonnet-4-5-20250929');
  // Using Sonnet 4 for artifact generation (best balance of speed and detailed output)
  models['artifact-model'] = getAnthropic()('claude-sonnet-4-5-20250929');

  return models;
};

// Lazy build language models to ensure env vars are loaded
let builtModels: Record<string, LanguageModel> | null = null;

const getLanguageModels = () => {
  if (!builtModels) {
    builtModels = buildLanguageModels();
  }
  return builtModels;
};

// Provider for production - uses real Anthropic models
export const myProvider = {
  languageModel: (modelId: string) => {
    logger.debug(`[Providers] Requesting model: ${modelId}`);
    const models = getLanguageModels();
    const model = models[modelId];
    if (!model) {
      logger.error(`[Providers] Available models:`, Object.keys(models));
      throw new Error(`Model ${modelId} not found in provider`);
    }
    return model;
  },
};
