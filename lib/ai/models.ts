export const DEFAULT_CHAT_MODEL: string = 'claude-sonnet-4';

export interface ChatModel {
  id: string;
  name: string;
  description: string;
  provider: 'anthropic';
  anthropicModelId: string;
  supportsReasoning?: boolean; // Native API reasoning support
}

export const chatModels: Array<ChatModel> = [
  // Claude Sonnet 4
  {
    id: 'claude-sonnet-4',
    name: 'Claude Sonnet 4',
    description: 'Fast, capable model for most tasks',
    provider: 'anthropic',
    anthropicModelId: 'claude-sonnet-4-20250514',
  },
  {
    id: 'claude-sonnet-4-thinking',
    name: 'Claude Sonnet 4 (Thinking)',
    description: 'With extended reasoning for complex problems',
    provider: 'anthropic',
    anthropicModelId: 'claude-sonnet-4-20250514',
    supportsReasoning: true, // Native API support
  },

  // Claude Opus 4.1
  {
    id: 'claude-opus-4-1',
    name: 'Claude Opus 4.1',
    description: 'Most capable model for challenging tasks',
    provider: 'anthropic',
    anthropicModelId: 'claude-opus-4-1-20250805',
  },
  {
    id: 'claude-opus-4-1-thinking',
    name: 'Claude Opus 4.1 (Thinking)',
    description: 'With deepest reasoning for the most complex problems',
    provider: 'anthropic',
    anthropicModelId: 'claude-opus-4-1-20250805',
    supportsReasoning: true,
  },
];
