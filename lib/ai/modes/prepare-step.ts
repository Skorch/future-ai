import { getLogger } from '@/lib/logger';

const logger = getLogger('prepare-step');
import type {
  ChatMode,
  ModeContext,
  Todo,
  Workspace,
  Objective,
} from '@/lib/db/schema';
import { getModeConfig } from './index';
import { myProvider } from '@/lib/ai/providers';
import type { LanguageModel } from 'ai';
import { createAgentBuilder } from '@/lib/ai/prompts/builders';
import type { Domain } from '@/lib/domains';

// Define PrepareStep types since they're not exported from 'ai'
interface PrepareStepInput {
  model: LanguageModel;
  // biome-ignore lint/suspicious/noExplicitAny: AI SDK steps are complex and vary by tools
  steps: any[];
  stepNumber: number;
  // biome-ignore lint/suspicious/noExplicitAny: Messages can have various content types
  messages: any[];
}

interface PrepareStepResult {
  model?: LanguageModel;
  system?: string;
  activeTools?: string[];
  // biome-ignore lint/suspicious/noExplicitAny: Messages can have various content types
  messages?: any[];
}

interface ModeState {
  currentMode: ChatMode;
  modeHistory: Array<{
    mode: ChatMode;
    stepNumber: number;
    reason?: string;
    timestamp: Date;
  }>;
  goal: string | null;
  todos: Todo[];
}

/**
 * Creates a stateful prepareStep function that manages mode transitions
 * across multiple steps within a single streamText execution.
 * Uses builder system to generate complete system prompts including
 * base prompt, capabilities, domain, mode, and contexts.
 */
export function createPrepareStep(
  initialMode: ChatMode,
  initialContext: ModeContext,
  domain: Domain,
  workspace: Workspace | null,
  objective: Objective | null,
) {
  // State persists across all steps via closure
  const state: ModeState = {
    currentMode: initialMode,
    modeHistory: [
      {
        mode: initialMode,
        stepNumber: 0,
        timestamp: new Date(),
      },
    ],
    goal: initialContext.goal,
    todos: initialContext.todoList || [],
  };

  // This function is called before EACH step
  return async ({
    steps,
    stepNumber,
    messages,
  }: PrepareStepInput): Promise<PrepareStepResult> => {
    logger.debug(
      `[prepareStep] Step ${stepNumber}, Mode: ${state.currentMode}, History: ${state.modeHistory.length} entries`,
    );

    // Check if previous step called setMode or setComplete
    if (steps.length > 0) {
      const lastStep = steps[steps.length - 1];

      // Check for mode switch in the last step's tool results
      // When we're in Step N, the previous Step N-1's tool calls are now in toolResults
      const setModeResult = lastStep?.toolResults?.find(
        // biome-ignore lint/suspicious/noExplicitAny: Tool result structure varies by tool
        (tr: any) => tr.toolName === 'setMode',
      );

      // Also check toolCalls for immediate detection within same step
      const setModeCall = lastStep?.toolCalls?.find(
        // biome-ignore lint/suspicious/noExplicitAny: Tool call structure varies by tool
        (tc: any) => tc.toolName === 'setMode',
      );

      // Get the mode switch data from either source
      // Tool results have data in 'output', tool calls have data in 'input'
      const modeData = setModeResult?.output || setModeCall?.input;

      if (modeData) {
        const { mode, reason, nextMessage } = modeData as {
          mode: ChatMode;
          reason: string;
          nextMessage?: string;
        };

        // Only update if mode actually changed
        if (mode !== state.currentMode) {
          logger.info(
            `[prepareStep] Mode transition detected: ${state.currentMode} → ${mode} (Reason: ${reason})`,
          );

          // Update mode state
          state.currentMode = mode;
          state.modeHistory.push({
            mode,
            stepNumber,
            reason,
            timestamp: new Date(),
          });

          // Limit history to prevent unbounded growth
          if (state.modeHistory.length > 10) {
            state.modeHistory = state.modeHistory.slice(-10);
          }

          // Note: We're NOT injecting the nextMessage anymore to prevent infinite loops
          // The mode switch itself is sufficient, and the AI will continue naturally
          // without needing an injected message that could trigger repeated actions
          if (nextMessage) {
            logger.info(
              `[prepareStep] NextMessage provided but not injected to prevent loops: "${nextMessage.substring(0, 50)}..."`,
            );
          }
        }
      }

      // Check for goal updates from any tool
      const goalUpdate = lastStep?.toolResults?.find(
        // biome-ignore lint/suspicious/noExplicitAny: Tool results vary by tool type
        (tr: any) =>
          tr.result && typeof tr.result === 'object' && 'goal' in tr.result,
      );
      if (goalUpdate?.result && 'goal' in goalUpdate.result) {
        state.goal = (goalUpdate.result as { goal: string }).goal;
      }
    }

    // Build current context
    const context: ModeContext = {
      currentMode: state.currentMode,
      goal: state.goal,
      todoList: state.todos,
      // biome-ignore lint/suspicious/noExplicitAny: Messages can have various structures
      messageCount: messages.filter((m: any) => m.role === 'user').length,
      modeSetAt: state.modeHistory[state.modeHistory.length - 1].timestamp,
    };

    // Get mode configuration for tools
    const modeConfig = getModeConfig(state.currentMode);

    // Use builder to generate complete system prompt
    // Includes: base + capabilities + domain + mode + workspace context + objective context
    const builder = createAgentBuilder(state.currentMode);
    const systemPrompt = await builder.generate(domain, workspace, objective);

    logger.debug(
      `[prepareStep] Applying ${state.currentMode} mode with ${modeConfig.experimental_activeTools.length} active tools`,
    );

    // Return configuration for this step
    return {
      // Complete system prompt from builder
      system: systemPrompt,

      // Set active tools based on mode
      activeTools: modeConfig.experimental_activeTools,

      // Optionally switch models based on mode
      ...(modeConfig.model && {
        model: myProvider.languageModel(modeConfig.model),
      }),

      // Pass through messages
      ...(messages && { messages }),
    };
  };
}
