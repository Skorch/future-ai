import {
  customProvider,
  extractReasoningMiddleware,
  wrapLanguageModel,
} from 'ai';
import { gateway } from '@ai-sdk/gateway';
import {
  artifactModel,
  chatModel,
  reasoningModel,
  titleModel,
} from './models.test';
import { chatModels } from './models';
import { isTestEnvironment } from '../constants';

// Build language models from our model definitions
const buildLanguageModels = () => {
  // biome-ignore lint/suspicious/noExplicitAny: Language models have varying types
  const models: Record<string, any> = {};

  // Add all chat models from models.ts
  for (const model of chatModels) {
    if (model.outputsRawReasoningTag) {
      // Apply middleware for models that output raw reasoning tags
      models[model.id] = wrapLanguageModel({
        model: gateway.languageModel(model.gatewayModelId),
        middleware: extractReasoningMiddleware({
          tagName: model.outputsRawReasoningTag,
        }),
      });
    } else {
      models[model.id] = gateway.languageModel(model.gatewayModelId);
    }
  }

  // Add title and artifact models (using xAI for now)
  models['title-model'] = gateway.languageModel('xai/grok-2-1212');
  models['artifact-model'] = gateway.languageModel('xai/grok-2-1212');

  return models;
};

export const myProvider = isTestEnvironment
  ? customProvider({
      languageModels: {
        'grok-vision': chatModel,
        'grok-reasoning': reasoningModel,
        'title-model': titleModel,
        'artifact-model': artifactModel,
      },
    })
  : customProvider({
      languageModels: buildLanguageModels(),
    });
