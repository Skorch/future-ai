export const DEFAULT_CHAT_MODEL: string = 'grok-vision';

export interface ChatModel {
  id: string;
  name: string;
  description: string;
  provider: 'xai' | 'anthropic' | 'openai' | 'google';
  gatewayModelId: string;
  supportsReasoning?: boolean; // Native API reasoning support
  outputsRawReasoningTag?: string; // Tag name to extract (e.g., 'thinking', 'think')
}

export const chatModels: Array<ChatModel> = [
  // xAI Models
  {
    id: 'grok-vision',
    name: 'Grok Vision',
    description: 'Advanced multimodal model with vision and text capabilities',
    provider: 'xai',
    gatewayModelId: 'xai/grok-2-vision-1212',
  },
  {
    id: 'grok-reasoning',
    name: 'Grok Reasoning',
    description:
      'Uses advanced chain-of-thought reasoning for complex problems',
    provider: 'xai',
    gatewayModelId: 'xai/grok-3-mini-beta',
    outputsRawReasoningTag: 'think', // Grok uses <think> tags
  },

  // Anthropic Models
  {
    id: 'claude-sonnet-4',
    name: 'Claude Sonnet 4',
    description: 'Fast, capable model',
    provider: 'anthropic',
    gatewayModelId: 'anthropic/claude-sonnet-4-20250514',
  },
  {
    id: 'claude-sonnet-4-thinking',
    name: 'Claude Sonnet 4 (Thinking)',
    description: 'With extended reasoning',
    provider: 'anthropic',
    gatewayModelId: 'anthropic/claude-sonnet-4-20250514',
    supportsReasoning: true, // Native API support
  },
  {
    id: 'claude-opus-4-1',
    name: 'Claude Opus 4.1',
    description: 'Most capable model',
    provider: 'anthropic',
    gatewayModelId: 'anthropic/claude-opus-4-1-20250805',
  },
  {
    id: 'claude-opus-4-1-thinking',
    name: 'Claude Opus 4.1 (Thinking)',
    description: 'With deepest reasoning',
    provider: 'anthropic',
    gatewayModelId: 'anthropic/claude-opus-4-1-20250805',
    supportsReasoning: true,
  },

  // OpenAI Models
  {
    id: 'gpt-5',
    name: 'GPT-5',
    description: "OpenAI's latest flagship model",
    provider: 'openai',
    gatewayModelId: 'openai/gpt-4o',
  },

  // Google Models
  {
    id: 'gemini-2-5-pro',
    name: 'Gemini 2.5 Pro',
    description: "Google's advanced multimodal AI model",
    provider: 'google',
    gatewayModelId: 'google/gemini-2.0-flash-exp',
  },
];
