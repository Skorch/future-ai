import { getLogger } from '@/lib/logger';

const logger = getLogger('providers');
import { customProvider, type LanguageModel } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import {
  artifactModel,
  chatModel,
  reasoningModel,
  titleModel,
} from './models.test';
import { chatModels } from './models';
import { isTestEnvironment } from '../constants';

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

// Create OpenAI provider instance - lazy initialization for reranking only
let openaiInstance: ReturnType<typeof createOpenAI> | null = null;

const getOpenAI = () => {
  if (!openaiInstance) {
    logger.info(
      '[Providers] Initializing OpenAI with API key:',
      process.env.OPENAI_API_KEY ? 'present' : 'missing',
    );

    openaiInstance = createOpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openaiInstance;
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
  models['title-model'] = getAnthropic()('claude-3-haiku-20240307');
  // Using Sonnet 4 for reranking (reliable structured outputs) - kept as fallback
  models['reranker-model'] = getAnthropic()('claude-3-5-sonnet-20241022');
  // Using Sonnet 4 for artifact generation (best balance of speed and detailed output)
  models['artifact-model'] = getAnthropic()('claude-sonnet-4-20250514');

  // Add OpenAI models for reranking ONLY - not exposed to chat interface
  // These models are exclusively for tool use, particularly the LLM reranker
  logger.info('[Providers] Registering OpenAI models for reranking...');

  // GPT-5 family
  models['openai-gpt-5-reranker'] = getOpenAI()('gpt-5');
  models['openai-gpt-5-mini-reranker'] = getOpenAI()('gpt-5-mini');
  models['openai-gpt-5-nano-reranker'] = getOpenAI()('gpt-5-nano');

  // GPT-4.1 family
  models['openai-gpt-4.1-reranker'] = getOpenAI()('gpt-4.1');
  models['openai-gpt-4.1-mini-reranker'] = getOpenAI()('gpt-4.1-mini');
  models['openai-gpt-4.1-nano-reranker'] = getOpenAI()('gpt-4.1-nano');

  logger.info('[Providers] OpenAI models registered');

  return models;
};

// Lazy build language models to ensure env vars are loaded
let builtModels: Record<string, LanguageModel> | null = null;

const getLanguageModels = () => {
  if (!builtModels) {
    logger.info('[Providers] Building language models...');
    builtModels = buildLanguageModels();
  }
  return builtModels;
};

export const myProvider = isTestEnvironment
  ? customProvider({
      languageModels: {
        'claude-sonnet-4': chatModel,
        'claude-sonnet-4-thinking': reasoningModel,
        'claude-opus-4-1': chatModel,
        'claude-opus-4-1-thinking': reasoningModel,
        'title-model': titleModel,
        'artifact-model': artifactModel,
      },
    })
  : {
      languageModel: (modelId: string) => {
        logger.info(`[Providers] Requesting model: ${modelId}`);
        const models = getLanguageModels();
        const model = models[modelId];
        if (!model) {
          logger.error(`[Providers] Available models:`, Object.keys(models));
          throw new Error(`Model ${modelId} not found in provider`);
        }
        logger.info(`[Providers] Model ${modelId} retrieved successfully`);
        return model;
      },
    };
