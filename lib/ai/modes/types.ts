import type { ModeContext } from '@/lib/db/schema';
import type { StopCondition } from 'ai';

// Mode configuration that mirrors streamText API parameters
export interface ModeConfig {
  // Core streamText parameters
  model: string;
  system: (context: ModeContext) => string; // Dynamic system prompt
  experimental_activeTools: string[]; // Still experimental in v5
  // biome-ignore lint/suspicious/noExplicitAny: StopCondition generic depends on runtime tool set
  stopWhen?: StopCondition<any> | Array<StopCondition<any>>;

  // Optional streamText parameters
  temperature?: number;
  maxOutputTokens?: number;
  topP?: number;
  topK?: number;
  presencePenalty?: number;
  frequencyPenalty?: number;
  stopSequences?: string[];

  // Still experimental in v5
  experimental_prepareStep?: (
    params: Record<string, unknown>,
  ) => Record<string, unknown>;

  // Any other streamText options can be added as needed
}
