export const DEFAULT_CHAT_MODEL: string = 'chat-model';

export interface ChatModel {
  id: string;
  name: string;
  description: string;
  provider: 'xai' | 'anthropic' | 'openai' | 'google';
  gatewayModelId: string;
}

export const chatModels: Array<ChatModel> = [
  // xAI Models
  {
    id: 'chat-model',
    name: 'Grok Vision',
    description: 'Advanced multimodal model with vision and text capabilities',
    provider: 'xai',
    gatewayModelId: 'xai/grok-2-vision-1212',
  },
  {
    id: 'chat-model-reasoning',
    name: 'Grok Reasoning',
    description: 'Uses advanced chain-of-thought reasoning for complex problems',
    provider: 'xai',
    gatewayModelId: 'xai/grok-3-mini-beta',
  },
  
  // Anthropic Models
  {
    id: 'claude-sonnet-4',
    name: 'Claude Sonnet 4',
    description: 'Anthropic\'s latest Sonnet model with advanced capabilities',
    provider: 'anthropic',
    gatewayModelId: 'anthropic/claude-3-5-sonnet-20241022',
  },
  {
    id: 'claude-opus-4-1',
    name: 'Claude Opus 4.1',
    description: 'Anthropic\'s most powerful model for complex reasoning',
    provider: 'anthropic',
    gatewayModelId: 'anthropic/claude-3-opus-20240229',
  },
  
  // OpenAI Models
  {
    id: 'gpt-5',
    name: 'GPT-5',
    description: 'OpenAI\'s latest flagship model',
    provider: 'openai',
    gatewayModelId: 'openai/gpt-4o',
  },
  
  // Google Models
  {
    id: 'gemini-2-5-pro',
    name: 'Gemini 2.5 Pro',
    description: 'Google\'s advanced multimodal AI model',
    provider: 'google',
    gatewayModelId: 'google/gemini-2.0-flash-exp',
  },
];
