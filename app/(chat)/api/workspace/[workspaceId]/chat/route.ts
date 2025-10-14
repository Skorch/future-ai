import {
  convertToModelMessages,
  createUIMessageStream,
  JsonToSseTransformStream,
  smoothStream,
  streamText,
  stepCountIs,
  hasToolCall,
} from 'ai';
import {
  analyzeTokenUsage,
  logTokenStats,
} from '@/lib/ai/utils/token-analyzer';
import { auth } from '@clerk/nextjs/server';
import { composeSystemPrompt } from '@/lib/ai/prompts/system';
import { getDomain, DEFAULT_DOMAIN, type DomainId } from '@/lib/domains';
import {
  createStreamId,
  getChatByIdWithWorkspace,
  getMessagesByChatId,
  saveChat,
  saveMessages,
  db,
} from '@/lib/db/queries';
import { getOrCreateActiveObjective } from '@/lib/db/objective';
import { initializeVersionForChat } from '@/lib/db/objective-document';
import { workspace, chat as chatTable } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { convertToUIMessages, generateUUID } from '@/lib/utils';
import { generateTitleFromUserMessage } from '@/app/(chat)/actions';
import { generateDocumentVersion } from '@/lib/ai/tools/generate-document-version';
import { updatePunchlist } from '@/lib/ai/tools/update-punchlist';
import { saveKnowledge } from '@/lib/ai/tools/save-knowledge';
import { queryRAG } from '@/lib/ai/tools/query-rag';
import { listDocuments } from '@/lib/ai/tools/list-documents';
import { loadDocument } from '@/lib/ai/tools/load-document';
import { loadDocuments } from '@/lib/ai/tools/load-documents';
import { setMode } from '@/lib/ai/tools/set-mode';
import { askUser } from '@/lib/ai/tools/ask-user';
import { getPlaybook } from '@/lib/ai/tools/get-playbook';
// TODO: Rewire to new DAL - updateDocumentVersionsMessageId stub removed
// import { updateDocumentVersionsMessageId } from '@/lib/db/documents';
import { isProductionEnvironment } from '@/lib/constants';
import { myProvider } from '@/lib/ai/providers';
import { postRequestBodySchema, type PostRequestBody } from './schema';
import {
  createResumableStreamContext,
  type ResumableStreamContext,
} from 'resumable-stream';
import { after } from 'next/server';
import { ChatSDKError } from '@/lib/errors';
import type { ChatMessage } from '@/lib/types';
import { DEFAULT_CHAT_MODEL } from '@/lib/ai/models';
import type { ChatMode, ModeContext, Todo, TodoList } from '@/lib/db/schema';
import { getModeConfig } from '@/lib/ai/modes';
import { createPrepareStep } from '@/lib/ai/modes/prepare-step';
import type { VisibilityType } from '@/components/visibility-selector';
import { processMessageFiles } from '@/lib/ai/utils/file-processor';
import { setComplete } from '@/lib/ai/tools/set-complete';
import { getLogger } from '@/lib/logger';

const logger = getLogger('ChatRoute');

export const maxDuration = 300; // 5 minutes (300 seconds)

let globalStreamContext: ResumableStreamContext | null = null;

function getStreamContext() {
  if (!globalStreamContext) {
    try {
      globalStreamContext = createResumableStreamContext({
        waitUntil: after,
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('REDIS_URL')) {
        logger.info('Resumable streams are disabled due to missing REDIS_URL');
      } else {
        logger.error('Failed to create resumable stream context', error);
      }
    }
  }

  return globalStreamContext;
}

export async function POST(
  request: Request,
  props: { params: Promise<{ workspaceId: string }> },
) {
  const params = await props.params;
  const { workspaceId } = params;
  let requestBody: PostRequestBody;

  try {
    const json = await request.json();
    requestBody = postRequestBodySchema.parse(json);
  } catch (error) {
    logger.error('Schema validation failed:', error);
    return new ChatSDKError('bad_request:api').toResponse();
  }

  try {
    const {
      id,
      message,
      selectedVisibilityType,
      objectiveId: providedObjectiveId,
    }: {
      id: string;
      message: ChatMessage;
      selectedVisibilityType: VisibilityType;
      objectiveId?: string;
    } = requestBody;

    logger.debug('Processing message', {
      chatId: id,
      messageRole: message.role,
      partsCount: message.parts?.length || 0,
      hasFileParts: message.parts?.some((p) => p.type === 'file'),
    });

    const { userId } = await auth();

    if (!userId) {
      return new ChatSDKError('unauthorized:chat').toResponse();
    }

    // Load domain from workspace
    const workspaceData = await db
      .select({ domainId: workspace.domainId })
      .from(workspace)
      .where(eq(workspace.id, workspaceId))
      .limit(1);

    const domainId = (workspaceData[0]?.domainId as DomainId) || DEFAULT_DOMAIN;
    const domain = getDomain(domainId);

    logger.debug(`Agent domain from workspace: ${domainId}`, {
      workspaceId,
      domainLabel: domain.label,
    });

    // Create session object for AI tools
    const session = { user: { id: userId } };

    // Rate limiting removed - no message limits

    const chat = await getChatByIdWithWorkspace({
      id,
      workspaceId,
      userId,
    });

    // Determine the final objectiveId for this chat
    let chatObjectiveId: string;

    if (!chat) {
      const title = await generateTitleFromUserMessage({
        message,
      });

      // Use provided objectiveId or fall back to active objective
      chatObjectiveId =
        providedObjectiveId ||
        (await getOrCreateActiveObjective(workspaceId, userId));

      // Initialize version for new chat (creates document if needed)
      const { versionId } = await initializeVersionForChat(
        id,
        chatObjectiveId,
        userId,
        workspaceId,
      );

      await saveChat({
        id,
        userId: userId,
        title,
        visibility: selectedVisibilityType,
        objectiveId: chatObjectiveId,
        objectiveDocumentVersionId: versionId,
      });

      logger.debug('Created chat with version', { chatId: id, versionId });
    } else {
      // Chat already exists, use its objectiveId
      chatObjectiveId = chat.objectiveId;

      // Ensure chat has version (backfill for old chats)
      if (!chat.objectiveDocumentVersionId) {
        logger.warn('Existing chat missing version, initializing', {
          chatId: id,
        });
        const { versionId } = await initializeVersionForChat(
          id,
          chatObjectiveId,
          userId,
          workspaceId,
        );

        // Update chat with version
        await db
          .update(chatTable)
          .set({ objectiveDocumentVersionId: versionId })
          .where(eq(chatTable.id, id));
      }
    }

    // === MODE SYSTEM INTEGRATION ===

    // Count messages for context
    const messagesFromDb = await getMessagesByChatId({ id });
    const userMessageCount = messagesFromDb.filter(
      (m) => m.role === 'user',
    ).length;

    // Load mode from database or set initial mode
    const currentMode: ChatMode = (chat?.mode as ChatMode) || 'discovery';

    // Parse existing todos from database (for future milestones)
    let todos: Todo[] = [];
    if (chat?.todoList) {
      try {
        const todoList: TodoList = JSON.parse(chat.todoList);
        todos = todoList.todos || [];
      } catch (e) {
        logger.error('Failed to parse todo list:', e);
      }
    }

    // Create mode context for system prompt
    const modeContext: ModeContext = {
      currentMode,
      goal: chat?.goal || null,
      todoList: todos,
      modeSetAt: chat?.modeSetAt || new Date(),
      messageCount: userMessageCount,
    };

    // Get mode-specific configuration (still needed for initial model selection)
    const modeConfig = getModeConfig(currentMode);

    // Create prepareStep function with initial state
    const prepareStepFn = createPrepareStep(
      currentMode,
      modeContext,
      chat?.complete || false,
    );

    logger.debug(
      `Current mode: ${currentMode}, Goal: ${modeContext.goal ? 'Set' : 'Not set'}, Todos: ${todos.length}, Complete: ${chat?.complete || false}`,
    );

    const uiMessages = [...convertToUIMessages(messagesFromDb), message];

    await saveMessages({
      messages: [
        {
          chatId: id,
          id: message.id,
          role: 'user',
          parts: message.parts,
          attachments: [],
          createdAt: new Date(),
        },
      ],
    });

    const streamId = generateUUID();
    await createStreamId({ streamId, chatId: id });

    // Mode will determine model selection later
    // For now, use default model
    const selectedModel = DEFAULT_CHAT_MODEL;

    // All models are now Anthropic, which supports tools
    const shouldDisableTools = false;

    // Process messages BEFORE creating the stream so it's available in onFinish
    const processedMessages = await processMessageFiles(uiMessages);

    // Calculate token usage BEFORE creating the stream
    // Use domain-specific prompt and capabilities
    const systemPromptText = await composeSystemPrompt({
      domainPrompts: [domain.prompt],
      domainId,
    });

    const modelMessages = convertToModelMessages(processedMessages);

    // Analyze token usage before streaming
    const userMsgCount = modelMessages.filter((m) => m.role === 'user').length;
    const tokenStats = analyzeTokenUsage(
      systemPromptText,
      modelMessages,
      userMsgCount,
    );

    // Log token stats for every call
    logTokenStats(tokenStats, userMsgCount);

    // Store initial token count for tracking growth
    let currentTokenCount = tokenStats.totalTokens;
    let stepCount = 0;

    const stream = createUIMessageStream({
      execute: async ({ writer: dataStream }) => {
        try {
          // Log details about processed messages
          const lastMessage = processedMessages[processedMessages.length - 1];
          const lastMessageParts = lastMessage?.parts || [];
          const textPart = lastMessageParts.find(
            (p): p is { type: 'text'; text: string } =>
              p.type === 'text' && 'text' in p,
          );

          // Log iteration details
          logger.debug(
            'Processing iteration',
            modelMessages.filter((m) => m.role === 'user').length,
          );
          logger.debug('Processed messages', {
            originalCount: uiMessages.length,
            processedCount: processedMessages.length,
            lastMessagePartsCount: lastMessageParts.length,
            lastMessagePartTypes: lastMessageParts.map((p) => p.type),
            hasTextContent: !!textPart,
            textLength: textPart?.text?.length || 0,
            // textPreview removed - contains user content
            startsWithFile: textPart?.text?.startsWith('File:') || false,
          });

          // System prompt already calculated above
          // const systemPromptText = systemPrompt({
          //   selectedModel,
          //   requestHints,
          // });

          const activeTools = shouldDisableTools
            ? []
            : [
                'generateDocumentVersion',
                'updatePunchlist',
                'saveKnowledge',
                'queryRAG',
                'listDocuments',
                'loadDocument',
                'loadDocuments',
              ];

          logger.debug('Starting streamText', {
            messagesCount: processedMessages.length,
            model: selectedModel,
            toolsEnabled: !shouldDisableTools,
            activeToolsCount: activeTools.length,
            systemPromptLength: systemPromptText.length,
            // systemPromptPreview removed - may contain sensitive configuration
            hasMeetingPrompt: systemPromptText.includes('Meeting Intelligence'),
            hasCreateDocumentMention:
              systemPromptText.includes('createDocument'),
            hasFileInstruction: systemPromptText.includes(
              'When you see "File:"',
            ),
          });

          // Model messages already converted above
          // const modelMessages = convertToModelMessages(processedMessages);

          // Token estimation moved to token-analyzer utility

          // Token analysis already done above using utility

          // Log model info for debugging
          logger.debug('Model configuration:', {
            model: modeConfig.model || selectedModel,
            mode: currentMode,
            activeTools: modeConfig.experimental_activeTools?.length || 0,
            contextLimit: 200000,
          });

          // Additional detailed logging when approaching limits (tokenStats already logged above)
          if (tokenStats.isOverLimit) {
            logger.error('CONTEXT EXCEEDS MODEL LIMIT');
            logger.error(
              'This request will likely fail with "prompt is too long" error',
            );
            logger.error('Check the TOKEN USAGE STATS above for details');
          } else if (tokenStats.isApproachingLimit) {
            logger.warn('WARNING: Approaching context limit');
            logger.warn('Check the TOKEN USAGE STATS above for details');
          }

          // Log detailed breakdown when large or over limit
          if (tokenStats.totalTokens > 50000 || tokenStats.isOverLimit) {
            logger.warn('HIGH TOKEN USAGE DETECTED');
            logger.warn('Top 5 largest messages:');
            tokenStats.largestMessages.forEach((msg, idx) => {
              logger.warn(
                `  ${idx + 1}. Message #${msg.index} (${msg.role}): ${msg.tokens} tokens`,
              );
            });
          }

          // Deep logging to understand message structure
          const lastProcessedMsg =
            processedMessages[processedMessages.length - 1];
          const lastModelMsg = modelMessages[modelMessages.length - 1];

          logger.debug('Message Conversion Debug:', {
            // Before conversion
            processedMessage: {
              role: lastProcessedMsg?.role,
              partsCount: lastProcessedMsg?.parts?.length,
              partTypes: lastProcessedMsg?.parts?.map(
                (p: { type: string; text?: string }) => ({
                  type: p.type,
                  hasText: !!p.text,
                  textLength: p.text?.length || 0,
                  // textPreview removed - contains user content
                }),
              ),
              // fullParts removed - contains user content
            },
            // After conversion
            modelMessage: {
              role: lastModelMsg?.role,
              contentType: typeof lastModelMsg?.content,
              contentLength:
                typeof lastModelMsg?.content === 'string'
                  ? lastModelMsg.content.length
                  : Array.isArray(lastModelMsg?.content)
                    ? lastModelMsg.content.length
                    : 0,
              // contentPreview removed - may contain sensitive data
              // fullContent removed - contains message content
            },
          });

          logger.debug(
            'About to call streamText with mode-based model:',
            modeConfig.model || selectedModel,
          );
          logger.debug(
            'ANTHROPIC_API_KEY present:',
            !!process.env.ANTHROPIC_API_KEY,
          );

          const modelInstance = myProvider.languageModel(
            modeConfig.model || selectedModel,
          );

          let result: ReturnType<typeof streamText>;
          try {
            // Extract specific props from modeConfig
            // Note: We no longer use stopWhen from mode config - it's universal now
            const {
              system: _modeSystemPrompt, // prepareStep will handle system prompt
              model: _model, // We use modelInstance instead
              stopWhen: _stopWhen, // Ignore mode-specific stopWhen
              thinkingBudget,
              ...restModeConfig
            } = modeConfig;

            // Build provider options with thinking budget if configured
            const providerOptions: {
              anthropic?: {
                thinking?: {
                  type: 'enabled';
                  budgetTokens: number;
                };
              };
            } = {};

            if (thinkingBudget && thinkingBudget > 0) {
              providerOptions.anthropic = {
                thinking: {
                  type: 'enabled' as const,
                  budgetTokens: thinkingBudget,
                },
              };
            }

            // Build tools object (with async tool building)
            const playbookTool = await getPlaybook({ domainId });
            const tools = shouldDisableTools
              ? {}
              : {
                  // Mode and completion tools
                  setMode: setMode({ chatId: id, dataStream }),
                  setComplete: setComplete({ chatId: id, dataStream }),

                  // Document generation tool (replaces create/update)
                  generateDocumentVersion: generateDocumentVersion({
                    session,
                    dataStream,
                    workspaceId,
                    chatId: id,
                  }),

                  // Punchlist update tool (Phase 4)
                  updatePunchlist: updatePunchlist({
                    session,
                    dataStream,
                    workspaceId,
                    chatId: id,
                  }),

                  // Knowledge processing tool (Phase 3)
                  saveKnowledge: saveKnowledge({
                    session,
                    dataStream,
                    workspaceId,
                    objectiveId: chatObjectiveId,
                  }),

                  // Query and load tools
                  queryRAG: queryRAG({
                    session,
                    dataStream,
                    workspaceId,
                    domainId,
                  }),
                  listDocuments: await listDocuments({
                    session,
                    workspaceId,
                    domainId,
                    objectiveId: chatObjectiveId,
                  }),
                  loadDocument: loadDocument({ session, workspaceId }),
                  loadDocuments: loadDocuments({ session, workspaceId }),
                  askUser: askUser({ dataStream }),

                  // Playbook tool (conditionally registered if playbooks exist for domain)
                  ...(playbookTool ? { getPlaybook: playbookTool } : {}),
                };

            const streamOptions: Parameters<typeof streamText>[0] = {
              // Spread safe mode config (excluding stopWhen which is added later)
              ...restModeConfig,

              // Override with actual model instance
              model: modelInstance,

              // Base system prompt (prepareStep will override per step)
              system: systemPromptText,

              // Standard messages
              messages: modelMessages,

              // Add provider options if thinking budget is set
              ...(Object.keys(providerOptions).length > 0 && {
                providerOptions,
              }),

              // Tools - define all, experimental_activeTools from mode config filters them
              tools,

              // Add prepareStep for dynamic mode and tool management
              prepareStep: prepareStepFn,

              // Universal stopWhen conditions (not mode-specific)
              stopWhen: [
                stepCountIs(30), // Max steps to prevent infinite loops
                // Don't stop on setMode - let prepareStep handle seamless transitions
                // hasToolCall('setComplete'), // Stop when marking complete/incomplete
                hasToolCall('askUser'), // Stop when user input is required
              ],

              // Keep existing options that shouldn't be overridden
              experimental_transform: smoothStream({ chunking: 'word' }),
              experimental_telemetry: {
                isEnabled: isProductionEnvironment,
                functionId: 'stream-text',
              },
              // Hook into the agent loop to track token growth
              onStepFinish: (event) => {
                stepCount++;
                logger.debug(`Agent Step ${stepCount} Completed`);

                // Log finish reason to understand why the step ended
                if (event.finishReason) {
                  logger.debug(`  Finish reason: ${event.finishReason}`);
                }

                // Log what happened in this step
                if (event.toolCalls && event.toolCalls.length > 0) {
                  logger.debug(
                    '  Tools called:',
                    event.toolCalls.map((t) => t.toolName).join(', '),
                  );
                }

                // Estimate token growth from tool results
                if (event.toolResults && event.toolResults.length > 0) {
                  event.toolResults.forEach((result) => {
                    const resultSize = JSON.stringify(result).length;
                    const resultTokens = Math.ceil(resultSize / 4);
                    logger.debug(
                      `  Tool result size: ${resultTokens.toLocaleString()} tokens`,
                    );
                    currentTokenCount += resultTokens;
                  });
                }

                // Estimate tokens from text generation
                if (event.text) {
                  const textTokens = Math.ceil(event.text.length / 4);
                  currentTokenCount += textTokens;
                  logger.debug(
                    `  Generated text: ${textTokens.toLocaleString()} tokens`,
                  );
                }

                logger.debug(
                  `  Current total: ${currentTokenCount.toLocaleString()} tokens`,
                );
                logger.debug(
                  `  Remaining capacity: ${(200000 - currentTokenCount).toLocaleString()} tokens`,
                );

                // Warn if approaching limit during execution
                if (currentTokenCount > 180000) {
                  logger.warn(
                    'WARNING: Approaching token limit during execution!',
                  );
                }
              },
            };

            // Log the actual request being sent
            logger.debug('Full streamText options being sent:', {
              modelType: typeof streamOptions.model,
              systemLength: streamOptions.system?.length,
              messagesCount: streamOptions.messages?.length || 0,
              messages: streamOptions.messages?.map((m) => ({
                role: m.role,
                contentLength:
                  typeof m.content === 'string'
                    ? m.content.length
                    : Array.isArray(m.content)
                      ? JSON.stringify(m.content).length
                      : 0,
                // contentPreview removed - contains user message content
              })),
              maxOutputTokens: (streamOptions as Record<string, unknown>)
                .maxOutputTokens,
              providerOptions: JSON.stringify(streamOptions.providerOptions),
              tools: Object.keys(streamOptions.tools || {}),
            });

            // Call streamText with all options (stopWhen is now in streamOptions)
            result = streamText(streamOptions);
          } catch (streamError: unknown) {
            logger.error('STREAM ERROR');
            logger.error('Error calling streamText:', streamError);
            logger.error('Error occurred AFTER context analysis');
            logger.error('Total tokens attempted:', tokenStats.totalTokens);
            logger.error('Model limit: 200,000');
            logger.error('Over by:', tokenStats.totalTokens - 200000, 'tokens');
            // End of stream error section

            // Log detailed error information for debugging
            const error = streamError as {
              responseBody?: string;
              statusCode?: number;
              name?: string;
              message?: string;
            };

            let userFriendlyError =
              'An error occurred while processing your request.';
            let isPromptTooLong = false;

            if (error?.responseBody) {
              try {
                const errorBody = JSON.parse(error.responseBody);
                logger.error('Anthropic API Error Details:', {
                  type: errorBody?.error?.type,
                  message: errorBody?.error?.message,
                  requestId: errorBody?.request_id,
                  statusCode: error?.statusCode,
                  // Log what we actually sent
                  requestDetails: {
                    modelId: selectedModel,
                    messagesCount: modelMessages.length,
                    systemPromptLength: systemPromptText.length,
                    estimatedInputTokens: tokenStats.totalTokens,
                  },
                });

                // Check for prompt too long error
                // Check for exact error message format
                if (
                  errorBody?.error?.message?.includes('prompt is too long') ||
                  (errorBody?.error?.message?.includes('tokens') &&
                    errorBody?.error?.message?.includes('maximum')) ||
                  errorBody?.error?.type === 'invalid_request_error'
                ) {
                  isPromptTooLong = true;
                  const tokenMatch = errorBody?.error?.message?.match(
                    /(\d+)\s+tokens?\s+>\s+(\d+)\s+maximum/,
                  );
                  if (tokenMatch) {
                    const [, actualTokens, maxTokens] = tokenMatch;
                    userFriendlyError = `Error [AI_APICallError]: prompt is too long: ${actualTokens} tokens > ${maxTokens} maximum`;
                    logger.error(
                      'PROMPT LENGTH ERROR - API reported:',
                      actualTokens,
                      'tokens vs',
                      maxTokens,
                      'maximum',
                    );
                    logger.error(
                      'Our estimate was:',
                      tokenStats.totalTokens,
                      'tokens',
                    );
                    logger.error(
                      'Estimation accuracy:',
                      `${Math.round((tokenStats.totalTokens / Number.parseInt(actualTokens)) * 100)}%`,
                    );
                  } else {
                    userFriendlyError = `Error [AI_APICallError]: ${errorBody?.error?.message || 'Prompt is too long for the current model'}`;
                    logger.error(
                      'PROMPT LENGTH ERROR - Message:',
                      errorBody?.error?.message,
                    );
                  }
                } else if (errorBody?.error?.message) {
                  userFriendlyError = `Error: ${errorBody?.error?.message}`;
                }
              } catch (parseError) {
                logger.error(
                  'Could not parse error body:',
                  error?.responseBody,
                );
              }
            } else if (error?.message?.includes('prompt is too long')) {
              isPromptTooLong = true;
              userFriendlyError = `Error [AI_APICallError]: ${error.message}`;
            }

            // Create an error response to send to the client
            const errorResponse = {
              error: userFriendlyError,
              details: {
                isPromptTooLong,
                estimatedTokens: tokenStats.totalTokens,
                modelLimit: 200000,
                model: selectedModel,
              },
            };

            // Log error to console for visibility
            if (isPromptTooLong) {
              // Comprehensive context analysis when hitting the limit
              logger.error('PROMPT TOO LONG ERROR');
              logger.error('Error Details:', errorResponse);

              // Also analyze the original processed messages for file content
              interface FileContentInfo {
                messageIndex: number;
                contentLength: number;
                preview: string;
              }

              const fileAnalysis = processedMessages
                .map((msg, idx) => {
                  const fileParts = msg.parts
                    ?.filter(
                      (p): p is { type: 'text'; text: string } =>
                        p.type === 'text' &&
                        'text' in p &&
                        typeof p.text === 'string' &&
                        p.text.startsWith('File:'),
                    )
                    .map((p) => ({
                      messageIndex: idx,
                      contentLength: p.text.length,
                      preview: p.text.substring(0, 200),
                    }));
                  return fileParts?.length ? fileParts : null;
                })
                .filter(Boolean)
                .flat() as FileContentInfo[];

              if (fileAnalysis.length > 0) {
                logger.error('FILE CONTENT DETECTED IN MESSAGES:');
                fileAnalysis.forEach((file) => {
                  logger.error(
                    `  - Message #${file.messageIndex}: ${file.contentLength} chars`,
                  );
                  // Preview removed - contains user content
                });
              }

              // Simplified error analysis using tokenStats
              logger.error('DETAILED ERROR ANALYSIS:');
              logger.error(
                '  System prompt tokens:',
                tokenStats.systemPromptTokens,
              );
              logger.error('  User message tokens:', tokenStats.userTokens);
              logger.error(
                '  Assistant message tokens:',
                tokenStats.assistantTokens,
              );
              logger.error('  Total tokens:', tokenStats.totalTokens);
              logger.error(
                '  Over limit by:',
                tokenStats.totalTokens - 200000,
                'tokens',
              );

              logger.error('TOP 5 LARGEST MESSAGES:');
              tokenStats.largestMessages.forEach((msg, idx) => {
                logger.error(
                  `    ${idx + 1}. Message #${msg.index} (${msg.role}): ${msg.tokens.toLocaleString()} tokens`,
                );
                // Preview removed - contains user content
              });
              // Blank line for readability

              logger.error('SUGGESTIONS TO REDUCE CONTEXT:');
              logger.error('  1. Start a new chat');
              logger.error(
                '  2. Use loadDocument with maxChars parameter to limit content',
              );
              logger.error('  3. Load fewer documents at once');
              logger.error('  4. Clear older messages from the conversation');
              logger.error('End of context reduction suggestions');
            }

            // Re-throw with the user-friendly message
            const enhancedError = new Error(userFriendlyError) as Error & {
              originalError?: unknown;
              isPromptTooLong?: boolean;
            };
            enhancedError.originalError = streamError;
            enhancedError.isPromptTooLong = isPromptTooLong;
            throw enhancedError;
          }

          logger.debug('Starting stream consumption');

          // The AI SDK doesn't expose onStepFinish directly,
          // but we can log tool usage through the stream

          result.consumeStream();

          dataStream.merge(
            result.toUIMessageStream({
              sendReasoning: true,
            }),
          );

          logger.debug('Stream merged with UI');
        } catch (streamError) {
          logger.error('Stream error:', streamError);
          throw streamError;
        }
      },
      generateId: generateUUID,
      onFinish: async ({ messages }) => {
        const toolCalls = messages.filter((m) =>
          m.parts?.some((p: { type: string }) => p.type === 'tool-call'),
        );

        // Check BOTH the saved messages AND the original processed messages for file uploads
        const lastUserMessage = messages.filter((m) => m.role === 'user').pop();
        const lastProcessedUserMessage = processedMessages
          ?.filter((m) => m.role === 'user')
          .pop();

        const hasFileUpload =
          lastUserMessage?.parts?.some(
            (p) =>
              p.type === 'text' &&
              'text' in p &&
              (p as { text: string }).text?.startsWith('File:'),
          ) ||
          lastProcessedUserMessage?.parts?.some(
            (p) =>
              p.type === 'text' &&
              'text' in p &&
              (p as { text: string }).text?.startsWith('File:'),
          );

        logger.info('Stream finished', {
          totalMessages: messages.length,
          lastMessageRole: messages[messages.length - 1]?.role,
          hasToolCalls: toolCalls.length > 0,
          toolCallCount: toolCalls.length,
          toolNames: toolCalls.flatMap(
            (m) =>
              m.parts
                ?.filter(
                  (p: { type: string; toolName?: string }) =>
                    p.type === 'tool-call',
                )
                .map((p: { type: string; toolName?: string }) => p.toolName) ||
              [],
          ),
          hadFileUpload: hasFileUpload,
          expectedToolCall:
            hasFileUpload && toolCalls.length === 0
              ? 'WARNING: File uploaded but no tool called!'
              : 'OK',
        });

        // If a file was uploaded but no tool was called, log error and notify user
        if (hasFileUpload && toolCalls.length === 0) {
          logger.error(
            'ERROR: File was uploaded but AI did not call createDocument tool',
          );

          // Send an error message to the UI
          const errorMessage: ChatMessage = {
            id: generateUUID(),
            role: 'assistant',
            parts: [
              {
                type: 'text',
                text: '⚠️ I noticed you uploaded a file but I didn\'t process it correctly. Please try again or type "summarize the uploaded file" to trigger processing.',
              },
            ],
            metadata: {
              createdAt: new Date().toISOString(),
            },
          };

          // Add error message to saved messages
          messages.push(errorMessage);
        }

        // 1. Save messages FIRST (FK target must exist)
        await saveMessages({
          messages: messages.map((message) => {
            // Ensure assistant messages always have at least a text part
            // to prevent "empty content" errors when reloading conversations
            let parts = message.parts || [];

            if (message.role === 'assistant') {
              const hasTextPart = parts.some((part) => part.type === 'text');
              if (!hasTextPart) {
                // Add a minimal text part if the assistant only has tool calls
                parts = [{ type: 'text', text: '' }, ...parts];
              }
            }

            return {
              id: message.id,
              role: message.role,
              parts,
              createdAt: new Date(),
              attachments: [],
              chatId: id,
            };
          }),
        });

        // 2. THEN link document versions to assistant messages
        const assistantMessages = messages.filter(
          (m) => m.role === 'assistant',
        );
        const documentVersionUpdates = assistantMessages.flatMap((message) => {
          // Type guard for tool parts with document output
          type ToolPart = {
            type: string;
            output?: { versionId?: string };
          };
          const parts = (message.parts || []) as ToolPart[];
          return parts
            .filter(
              (part): part is ToolPart & { output: { versionId: string } } =>
                part.type === 'tool-createDocument' &&
                typeof part.output?.versionId === 'string',
            )
            .map((part) => ({
              versionId: part.output.versionId,
              messageId: message.id,
            }));
        });

        // TODO: Phase 4 - Implement updateDocumentVersionsMessageId for objective-document
        // This will link document versions to the messages that created them
        if (documentVersionUpdates.length > 0) {
          logger.debug(
            'Document versions created (linking to messages not yet implemented)',
            {
              count: documentVersionUpdates.length,
              updates: documentVersionUpdates,
            },
          );
          // try {
          //   await updateDocumentVersionsMessageId(documentVersionUpdates);
          //   logger.debug('Linked document versions to messages', {
          //     count: documentVersionUpdates.length,
          //     updates: documentVersionUpdates,
          //   });
          // } catch (error) {
          //   logger.error('Failed to link document versions to messages', {
          //     error,
          //     updates: documentVersionUpdates,
          //   });
          //   // Don't fail the entire request - versions will remain unlinked
          //   // but documents are still created and functional
          // }
        }
      },
      onError: (error: unknown) => {
        const errorDetails =
          error instanceof Error
            ? {
                message: error.message,
                stack: error.stack,
                cause: error.cause,
              }
            : { raw: error };
        logger.error('Stream processing error:', errorDetails);

        // Check for rate limit error
        const errorMessage =
          error instanceof Error
            ? error.message
            : 'An error occurred while processing your request';

        if (errorMessage.includes('429')) {
          logger.error(
            'Rate limit error detected. Check your Anthropic API usage.',
          );
        }

        return errorMessage;
      },
    });

    const streamContext = getStreamContext();

    if (streamContext) {
      return new Response(
        await streamContext.resumableStream(streamId, () =>
          stream.pipeThrough(new JsonToSseTransformStream()),
        ),
      );
    } else {
      return new Response(stream.pipeThrough(new JsonToSseTransformStream()));
    }
  } catch (error) {
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }

    logger.error('Unhandled error:', error);
    return new ChatSDKError('offline:chat').toResponse();
  }
}
