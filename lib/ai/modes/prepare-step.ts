import type { ChatMode, ModeContext, Todo } from '@/lib/db/schema';
import { getModeConfig } from './index';
import { myProvider } from '@/lib/ai/providers';
import type { LanguageModel } from 'ai';

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
  isComplete: boolean;
}

/**
 * Creates a stateful prepareStep function that manages mode transitions
 * and completion tracking across multiple steps within a single streamText execution.
 */
export function createPrepareStep(
  initialMode: ChatMode,
  initialContext: ModeContext,
  initialComplete = false,
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
    isComplete: initialComplete,
  };

  // This function is called before EACH step
  return ({
    steps,
    stepNumber,
    messages,
  }: PrepareStepInput): PrepareStepResult => {
    console.log(
      `[prepareStep] Step ${stepNumber}, Mode: ${state.currentMode}, Complete: ${state.isComplete}, History: ${state.modeHistory.length} entries`,
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
          console.log(
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
            console.log(
              `[prepareStep] NextMessage provided but not injected to prevent loops: "${nextMessage.substring(0, 50)}..."`,
            );
          }
        }
      }

      // Check for completion status change
      const setCompleteCall = lastStep?.toolCalls?.find(
        // biome-ignore lint/suspicious/noExplicitAny: Tool call structure varies by tool
        (tc: any) => tc.toolName === 'setComplete',
      );

      if (setCompleteCall?.args) {
        const { complete, reason } = setCompleteCall.args as {
          complete: boolean;
          reason?: string;
        };

        console.log(
          `[prepareStep] Completion status changed: ${state.isComplete} → ${complete}${reason ? ` (Reason: ${reason})` : ''}`,
        );

        state.isComplete = complete;
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

    // Get mode configuration
    const modeConfig = getModeConfig(state.currentMode);

    // Build dynamic system prompt with completion status
    const baseSystemPrompt = modeConfig.system(context);
    const completionStatus = state.isComplete
      ? '\n\n📋 STATUS: This task/conversation has been marked as COMPLETE. If the user asks for more help, you should mark it as incomplete with setComplete(false) before proceeding.'
      : '';

    const modeSystemPrompt = baseSystemPrompt + completionStatus;

    console.log(
      `[prepareStep] Applying ${state.currentMode} mode: ${modeConfig.experimental_activeTools.length} active tools, Complete: ${state.isComplete}`,
    );

    // Return configuration for this step
    return {
      // Override system prompt with mode-specific content
      system: modeSystemPrompt,

      // Set active tools based on mode
      activeTools: modeConfig.experimental_activeTools,

      // Optionally switch models based on mode
      ...(modeConfig.model && {
        model: myProvider.languageModel(modeConfig.model),
      }),

      // Pass through modified messages if we injected continuation
      ...(messages && { messages }),
    };
  };
}
