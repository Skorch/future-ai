import {
  convertToModelMessages,
  createUIMessageStream,
  JsonToSseTransformStream,
  smoothStream,
  streamText,
} from 'ai';
import {
  analyzeTokenUsage,
  logTokenStats,
} from '@/lib/ai/utils/token-analyzer';
import { auth } from '@/app/(auth)/auth';
import { type RequestHints, systemPrompt } from '@/lib/ai/prompts';
import {
  createStreamId,
  deleteChatById,
  getChatById,
  getMessagesByChatId,
  saveChat,
  saveMessages,
} from '@/lib/db/queries';
import { convertToUIMessages, generateUUID } from '@/lib/utils';
import { generateTitleFromUserMessage } from '../../actions';
import { createDocument } from '@/lib/ai/tools/create-document';
import { updateDocument } from '@/lib/ai/tools/update-document';
import { requestSuggestions } from '@/lib/ai/tools/request-suggestions';
import { getWeather } from '@/lib/ai/tools/get-weather';
import { queryRAG } from '@/lib/ai/tools/query-rag';
import { listDocuments } from '@/lib/ai/tools/list-documents';
import { loadDocument } from '@/lib/ai/tools/load-document';
import { loadDocuments } from '@/lib/ai/tools/load-documents';
import { setMode } from '@/lib/ai/tools/set-mode';
import { isProductionEnvironment } from '@/lib/constants';
import { myProvider } from '@/lib/ai/providers';
import { postRequestBodySchema, type PostRequestBody } from './schema';
import { geolocation } from '@vercel/functions';
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
import type { VisibilityType } from '@/components/visibility-selector';
import { processMessageFiles } from '@/lib/ai/utils/file-processor';

export const maxDuration = 60 * 5;

let globalStreamContext: ResumableStreamContext | null = null;

export function getStreamContext() {
  if (!globalStreamContext) {
    try {
      globalStreamContext = createResumableStreamContext({
        waitUntil: after,
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('REDIS_URL')) {
        console.log(
          ' > Resumable streams are disabled due to missing REDIS_URL',
        );
      } else {
        console.error(error);
      }
    }
  }

  return globalStreamContext;
}

export async function POST(request: Request) {
  let requestBody: PostRequestBody;

  try {
    const json = await request.json();
    requestBody = postRequestBodySchema.parse(json);
  } catch (error) {
    console.error('[Chat API] Schema validation failed:', error);
    return new ChatSDKError('bad_request:api').toResponse();
  }

  try {
    const {
      id,
      message,
      selectedVisibilityType,
    }: {
      id: string;
      message: ChatMessage;
      selectedVisibilityType: VisibilityType;
    } = requestBody;

    console.log('[ChatRoute] Processing message', {
      chatId: id,
      messageRole: message.role,
      partsCount: message.parts?.length || 0,
      hasFileParts: message.parts?.some((p) => p.type === 'file'),
    });

    const session = await auth();

    if (!session?.user) {
      return new ChatSDKError('unauthorized:chat').toResponse();
    }

    // Rate limiting removed - no message limits

    const chat = await getChatById({ id });

    if (!chat) {
      const title = await generateTitleFromUserMessage({
        message,
      });

      await saveChat({
        id,
        userId: session.user.id,
        title,
        visibility: selectedVisibilityType,
      });
    } else {
      if (chat.userId !== session.user.id) {
        return new ChatSDKError('forbidden:chat').toResponse();
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
        console.error('Failed to parse todo list:', e);
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

    // Get mode-specific configuration
    const modeConfig = getModeConfig(currentMode);

    console.log(
      `[Mode System] Current mode: ${currentMode}, Goal: ${modeContext.goal ? 'Set' : 'Not set'}, Todos: ${todos.length}`,
    );

    const uiMessages = [...convertToUIMessages(messagesFromDb), message];

    const { longitude, latitude, city, country } = geolocation(request);

    const requestHints: RequestHints = {
      longitude,
      latitude,
      city,
      country,
    };

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
    const systemPromptText = systemPrompt({
      requestHints,
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
          console.log(
            '[ChatRoute] Processing iteration',
            modelMessages.filter((m) => m.role === 'user').length,
          );
          console.log('[ChatRoute] Processed messages', {
            originalCount: uiMessages.length,
            processedCount: processedMessages.length,
            lastMessagePartsCount: lastMessageParts.length,
            lastMessagePartTypes: lastMessageParts.map((p) => p.type),
            hasTextContent: !!textPart,
            textLength: textPart?.text?.length || 0,
            textPreview: textPart?.text?.substring(0, 200) || 'No text',
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
                'getWeather',
                'createDocument',
                'updateDocument',
                'requestSuggestions',
                'queryRAG',
                'listDocuments',
                'loadDocument',
                'loadDocuments',
              ];

          console.log('[ChatRoute] Starting streamText', {
            messagesCount: processedMessages.length,
            model: selectedModel,
            toolsEnabled: !shouldDisableTools,
            activeToolsList: activeTools,
            systemPromptLength: systemPromptText.length,
            systemPromptPreview: systemPromptText.substring(0, 500),
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
          console.log('[ChatRoute] Model configuration:', {
            model: modeConfig.model || selectedModel,
            mode: currentMode,
            activeTools: modeConfig.experimental_activeTools?.length || 0,
            contextLimit: 200000,
          });

          // Additional detailed logging when approaching limits (tokenStats already logged above)
          if (tokenStats.isOverLimit) {
            console.error('[ChatRoute] ⚠️⚠️⚠️ CONTEXT EXCEEDS MODEL LIMIT ⚠️⚠️⚠️');
            console.error(
              '[ChatRoute] This request will likely fail with "prompt is too long" error',
            );
            console.error(
              '[ChatRoute] Check the TOKEN USAGE STATS above for details',
            );
          } else if (tokenStats.isApproachingLimit) {
            console.warn('[ChatRoute] ⚠️ WARNING: Approaching context limit');
            console.warn(
              '[ChatRoute] Check the TOKEN USAGE STATS above for details',
            );
          }

          // Log detailed breakdown when large or over limit
          if (tokenStats.totalTokens > 50000 || tokenStats.isOverLimit) {
            console.log('[ChatRoute] HIGH TOKEN USAGE DETECTED');
            console.log('[ChatRoute] Top 5 largest messages:');
            tokenStats.largestMessages.forEach((msg, idx) => {
              console.log(
                `  ${idx + 1}. Message #${msg.index} (${msg.role}): ${msg.tokens} tokens`,
              );
            });
          }

          // Deep logging to understand message structure
          const lastProcessedMsg =
            processedMessages[processedMessages.length - 1];
          const lastModelMsg = modelMessages[modelMessages.length - 1];

          console.log('[ChatRoute] DETAILED Message Conversion Debug:', {
            // Before conversion
            processedMessage: {
              role: lastProcessedMsg?.role,
              partsCount: lastProcessedMsg?.parts?.length,
              partTypes: lastProcessedMsg?.parts?.map(
                (p: { type: string; text?: string }) => ({
                  type: p.type,
                  hasText: !!p.text,
                  textLength: p.text?.length || 0,
                  textPreview: p.text?.substring(0, 50),
                }),
              ),
              fullParts: JSON.stringify(lastProcessedMsg?.parts, null, 2),
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
              contentPreview:
                typeof lastModelMsg?.content === 'string'
                  ? lastModelMsg.content.substring(0, 100)
                  : JSON.stringify(lastModelMsg?.content).substring(0, 200),
              fullContent: JSON.stringify(lastModelMsg, null, 2),
            },
          });

          console.log(
            '[ChatRoute] About to call streamText with mode-based model:',
            modeConfig.model || selectedModel,
          );
          console.log(
            '[ChatRoute] ANTHROPIC_API_KEY present:',
            !!process.env.ANTHROPIC_API_KEY,
          );

          const modelInstance = myProvider.languageModel(
            modeConfig.model || selectedModel,
          );

          let result: ReturnType<typeof streamText>;
          try {
            // Extract specific props from modeConfig
            const {
              system: modeSystemPrompt,
              model: _model, // We use modelInstance instead
              stopWhen, // Extract but don't spread due to type issues
              ...restModeConfig
            } = modeConfig;

            const streamOptions: Parameters<typeof streamText>[0] = {
              // Spread safe mode config (excluding stopWhen)
              ...restModeConfig,

              // Override with actual model instance
              model: modelInstance,

              // Combine base prompt with mode-specific prompt
              system: `${systemPromptText}\n\n--- MODE CONTEXT ---\n${modeSystemPrompt(modeContext)}`,

              // Standard messages
              messages: modelMessages,

              // Tools - define all, experimental_activeTools from mode config filters them
              tools: shouldDisableTools
                ? {}
                : {
                    // Add setMode tool
                    setMode: setMode({ chatId: id, dataStream }),

                    // Existing tools
                    getWeather,
                    createDocument: createDocument({ session, dataStream }),
                    updateDocument: updateDocument({ session, dataStream }),
                    requestSuggestions: requestSuggestions({
                      session,
                      dataStream,
                    }),
                    queryRAG: queryRAG({ session, dataStream }),
                    listDocuments: listDocuments({ session }),
                    loadDocument: loadDocument({ session }),
                    loadDocuments: loadDocuments({ session }),
                  },

              // experimental_activeTools from mode config (already in spread)

              // Keep existing options that shouldn't be overridden
              experimental_transform: smoothStream({ chunking: 'word' }),
              experimental_telemetry: {
                isEnabled: isProductionEnvironment,
                functionId: 'stream-text',
              },
              // Hook into the agent loop to track token growth
              onStepFinish: (event) => {
                stepCount++;
                console.log(`\n[Agent Step ${stepCount}] Completed`);

                // Log what happened in this step
                if (event.toolCalls && event.toolCalls.length > 0) {
                  console.log(
                    '  Tools called:',
                    event.toolCalls.map((t) => t.toolName).join(', '),
                  );
                }

                // Estimate token growth from tool results
                if (event.toolResults && event.toolResults.length > 0) {
                  event.toolResults.forEach((result) => {
                    const resultSize = JSON.stringify(result).length;
                    const resultTokens = Math.ceil(resultSize / 4);
                    console.log(
                      `  Tool result size: ${resultTokens.toLocaleString()} tokens`,
                    );
                    currentTokenCount += resultTokens;
                  });
                }

                // Estimate tokens from text generation
                if (event.text) {
                  const textTokens = Math.ceil(event.text.length / 4);
                  currentTokenCount += textTokens;
                  console.log(
                    `  Generated text: ${textTokens.toLocaleString()} tokens`,
                  );
                }

                console.log(
                  `  Current total: ${currentTokenCount.toLocaleString()} tokens`,
                );
                console.log(
                  `  Remaining capacity: ${(200000 - currentTokenCount).toLocaleString()} tokens`,
                );

                // Warn if approaching limit during execution
                if (currentTokenCount > 180000) {
                  console.warn(
                    '  ⚠️ WARNING: Approaching token limit during execution!',
                  );
                }
              },
            };

            // Log the actual request being sent
            console.log('[ChatRoute] Full streamText options being sent:', {
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
                contentPreview:
                  typeof m.content === 'string'
                    ? m.content.substring(0, 100)
                    : JSON.stringify(m.content).substring(0, 100),
              })),
              maxOutputTokens: (streamOptions as Record<string, unknown>)
                .maxOutputTokens,
              providerOptions: JSON.stringify(streamOptions.providerOptions),
              tools: Object.keys(streamOptions.tools || {}),
            });

            // Call streamText - handle stopWhen separately due to type complexity
            // The AI SDK's StopCondition type is complex and we can't properly type it
            // when coming from our mode config, so we build the full options inline
            result = streamText(
              stopWhen
                ? {
                    ...streamOptions,
                    stopWhen: stopWhen as Parameters<
                      typeof streamText
                    >[0]['stopWhen'],
                  }
                : streamOptions,
            );
          } catch (streamError: unknown) {
            console.error(
              '\n==================== STREAM ERROR ====================',
            );
            console.error('[ChatRoute] Error calling streamText:', streamError);
            console.error('[ChatRoute] Error occurred AFTER context analysis');
            console.error(
              '[ChatRoute] Total tokens attempted:',
              tokenStats.totalTokens,
            );
            console.error('[ChatRoute] Model limit: 200,000');
            console.error(
              '[ChatRoute] Over by:',
              tokenStats.totalTokens - 200000,
              'tokens',
            );
            console.error(
              '======================================================\n',
            );

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
                console.error('[ChatRoute] Anthropic API Error Details:', {
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
                    console.error(
                      '[ChatRoute] PROMPT LENGTH ERROR - API reported:',
                      actualTokens,
                      'tokens vs',
                      maxTokens,
                      'maximum',
                    );
                    console.error(
                      '[ChatRoute] Our estimate was:',
                      tokenStats.totalTokens,
                      'tokens',
                    );
                    console.error(
                      '[ChatRoute] Estimation accuracy:',
                      `${Math.round((tokenStats.totalTokens / Number.parseInt(actualTokens)) * 100)}%`,
                    );
                  } else {
                    userFriendlyError = `Error [AI_APICallError]: ${errorBody?.error?.message || 'Prompt is too long for the current model'}`;
                    console.error(
                      '[ChatRoute] PROMPT LENGTH ERROR - Message:',
                      errorBody?.error?.message,
                    );
                  }
                } else if (errorBody?.error?.message) {
                  userFriendlyError = `Error: ${errorBody?.error?.message}`;
                }
              } catch (parseError) {
                console.error(
                  '[ChatRoute] Could not parse error body:',
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
              console.error(
                '[ChatRoute] ==================== PROMPT TOO LONG ERROR ====================',
              );
              console.error('[ChatRoute] Error Details:', errorResponse);

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
                console.error('[ChatRoute] FILE CONTENT DETECTED IN MESSAGES:');
                fileAnalysis.forEach((file) => {
                  console.error(
                    `  - Message #${file.messageIndex}: ${file.contentLength} chars`,
                  );
                  console.error(`    Preview: ${file.preview}...`);
                });
              }

              // Simplified error analysis using tokenStats
              console.error('[ChatRoute] DETAILED ERROR ANALYSIS:');
              console.error(
                '  System prompt tokens:',
                tokenStats.systemPromptTokens,
              );
              console.error('  User message tokens:', tokenStats.userTokens);
              console.error(
                '  Assistant message tokens:',
                tokenStats.assistantTokens,
              );
              console.error('  Total tokens:', tokenStats.totalTokens);
              console.error(
                '  Over limit by:',
                tokenStats.totalTokens - 200000,
                'tokens',
              );

              console.error('[ChatRoute] TOP 5 LARGEST MESSAGES:');
              tokenStats.largestMessages.forEach((msg, idx) => {
                console.error(
                  `    ${idx + 1}. Message #${msg.index} (${msg.role}): ${msg.tokens.toLocaleString()} tokens`,
                );
                console.error(`       Preview: "${msg.preview}..."`);
              });
              console.error('');

              console.error('[ChatRoute] SUGGESTIONS TO REDUCE CONTEXT:');
              console.error('  1. Start a new chat');
              console.error(
                '  2. Use loadDocument with maxChars parameter to limit content',
              );
              console.error('  3. Load fewer documents at once');
              console.error('  4. Clear older messages from the conversation');
              console.error(
                '[ChatRoute] ================================================================',
              );
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

          console.log('[ChatRoute] Starting stream consumption');

          // The AI SDK doesn't expose onStepFinish directly,
          // but we can log tool usage through the stream

          result.consumeStream();

          dataStream.merge(
            result.toUIMessageStream({
              sendReasoning: true,
            }),
          );

          console.log('[ChatRoute] Stream merged with UI');
        } catch (streamError) {
          console.error('[Chat API] Stream error:', streamError);
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

        console.log('[ChatRoute] Stream finished', {
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
          console.error(
            '[ChatRoute] ERROR: File was uploaded but AI did not call createDocument tool',
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
        console.error('[Chat API] Stream processing error:', errorDetails);

        // Check for rate limit error
        const errorMessage =
          error instanceof Error
            ? error.message
            : 'An error occurred while processing your request';

        if (errorMessage.includes('429')) {
          console.error(
            '[Chat API] Rate limit error detected. Check your Anthropic API usage.',
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

    console.error('[Chat API] Unhandled error:', error);
    return new ChatSDKError('offline:chat').toResponse();
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return new ChatSDKError('bad_request:api').toResponse();
  }

  const session = await auth();

  if (!session?.user) {
    return new ChatSDKError('unauthorized:chat').toResponse();
  }

  const chat = await getChatById({ id });

  if (chat.userId !== session.user.id) {
    return new ChatSDKError('forbidden:chat').toResponse();
  }

  const deletedChat = await deleteChatById({ id });

  return Response.json(deletedChat, { status: 200 });
}
