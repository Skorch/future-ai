import type { ModeContext } from '@/lib/db/schema';

// Mode configuration that mirrors streamText API parameters
export interface ModeConfig {
  // Core streamText parameters
  model: string;
  system: (context: ModeContext) => string; // Dynamic system prompt
  experimental_activeTools: string[]; // Still experimental in v5
  // stopWhen will be properly typed when used in streamText
  // Using unknown here as the generic StopCondition<T> depends on the tool set
  stopWhen?: unknown;

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
