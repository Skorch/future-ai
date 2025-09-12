import {
  convertToModelMessages,
  createUIMessageStream,
  JsonToSseTransformStream,
  smoothStream,
  stepCountIs,
  streamText,
} from 'ai';
import { auth, type UserType } from '@/app/(auth)/auth';
import { type RequestHints, systemPrompt } from '@/lib/ai/prompts';
import {
  createStreamId,
  deleteChatById,
  getChatById,
  getMessageCountByUserId,
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
import { writeToRAG } from '@/lib/ai/tools/write-to-rag';
import { queryRAG } from '@/lib/ai/tools/query-rag';
import { isProductionEnvironment } from '@/lib/constants';
import { myProvider } from '@/lib/ai/providers';
import { entitlementsByUserType } from '@/lib/ai/entitlements';
import { postRequestBodySchema, type PostRequestBody } from './schema';
import { geolocation } from '@vercel/functions';
import {
  createResumableStreamContext,
  type ResumableStreamContext,
} from 'resumable-stream';
import { after } from 'next/server';
import { ChatSDKError } from '@/lib/errors';
import type { ChatMessage } from '@/lib/types';
import { chatModels, type ChatModel } from '@/lib/ai/models';
import type { VisibilityType } from '@/components/visibility-selector';
import { processMessageFiles } from '@/lib/ai/utils/file-processor';

export const maxDuration = 60;

let globalStreamContext: ResumableStreamContext | null = null;

export function getStreamContext() {
  if (!globalStreamContext) {
    try {
      globalStreamContext = createResumableStreamContext({
        waitUntil: after,
      });
      // biome-ignore lint/suspicious/noExplicitAny: Error type is unknown
    } catch (error: any) {
      if (error.message.includes('REDIS_URL')) {
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
      selectedChatModel,
      selectedVisibilityType,
    }: {
      id: string;
      message: ChatMessage;
      selectedChatModel: ChatModel['id'];
      selectedVisibilityType: VisibilityType;
    } = requestBody;

    console.log('[ChatRoute] Processing message', {
      chatId: id,
      messageRole: message.role,
      partsCount: message.parts?.length || 0,
      hasFileParts: message.parts?.some(p => p.type === 'file'),
      selectedModel: selectedChatModel,
    });

    const session = await auth();

    if (!session?.user) {
      return new ChatSDKError('unauthorized:chat').toResponse();
    }

    const userType: UserType = session.user.type;

    const messageCount = await getMessageCountByUserId({
      id: session.user.id,
      differenceInHours: 24,
    });

    if (messageCount > entitlementsByUserType[userType].maxMessagesPerDay) {
      return new ChatSDKError('rate_limit:chat').toResponse();
    }

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

    const messagesFromDb = await getMessagesByChatId({ id });
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

    // Get model configuration to check for reasoning capabilities
    const modelConfig = chatModels.find((m) => m.id === selectedChatModel);
    const isReasoningModel =
      modelConfig?.supportsReasoning || modelConfig?.outputsRawReasoningTag;

    // Anthropic models support tools with reasoning, other providers may have issues
    // - Anthropic has "think" tool and interleaved thinking support
    // - xAI/Grok has limitations with reasoning + tools (performance/cost issues)
    // - Other providers untested with reasoning + tools
    const shouldDisableTools =
      isReasoningModel && modelConfig?.provider !== 'anthropic';

    // Only add provider options for models with native reasoning support
    const providerOptions = modelConfig?.supportsReasoning
      ? {
          anthropic: {
            thinking: {
              type: 'enabled' as const,
              budgetTokens: 12000, // 12k tokens for thinking process
            },
          },
        }
      : undefined;

    // Process messages BEFORE creating the stream so it's available in onFinish
    const processedMessages = await processMessageFiles(uiMessages);
    
    const stream = createUIMessageStream({
      execute: async ({ writer: dataStream }) => {
        try {
          // Log details about processed messages
          const lastMessage = processedMessages[processedMessages.length - 1];
          const lastMessageParts = lastMessage?.parts || [];
          const textPart = lastMessageParts.find((p): p is { type: 'text'; text: string } => 
            p.type === 'text' && 'text' in p
          );
          
          console.log('[ChatRoute] Processed messages', {
            originalCount: uiMessages.length,
            processedCount: processedMessages.length,
            lastMessagePartsCount: lastMessageParts.length,
            lastMessagePartTypes: lastMessageParts.map(p => p.type),
            hasTextContent: !!textPart,
            textLength: textPart?.text?.length || 0,
            textPreview: textPart?.text?.substring(0, 200) || 'No text',
            startsWithFile: textPart?.text?.startsWith('File:') || false,
          });

          const systemPromptText = systemPrompt({ selectedChatModel, requestHints });
          
          const activeTools = shouldDisableTools ? [] : [
            'getWeather',
            'createDocument',
            'updateDocument',
            'requestSuggestions',
            'writeToRAG',
            'queryRAG',
          ];
          
          console.log('[ChatRoute] Starting streamText', {
            messagesCount: processedMessages.length,
            model: selectedChatModel,
            toolsEnabled: !shouldDisableTools,
            activeToolsList: activeTools,
            systemPromptLength: systemPromptText.length,
            systemPromptPreview: systemPromptText.substring(0, 500),
            hasMeetingPrompt: systemPromptText.includes('Meeting Intelligence'),
            hasCreateDocumentMention: systemPromptText.includes('createDocument'),
            hasFileInstruction: systemPromptText.includes('When you see "File:"'),
          });
          
          // Log the actual content being sent to the AI
          const modelMessages = convertToModelMessages(processedMessages);
          
          // Deep logging to understand message structure
          const lastProcessedMsg = processedMessages[processedMessages.length - 1];
          const lastModelMsg = modelMessages[modelMessages.length - 1];
          
          console.log('[ChatRoute] DETAILED Message Conversion Debug:', {
            // Before conversion
            processedMessage: {
              role: lastProcessedMsg?.role,
              partsCount: lastProcessedMsg?.parts?.length,
              partTypes: lastProcessedMsg?.parts?.map((p: any) => ({ 
                type: p.type, 
                hasText: !!p.text,
                textLength: p.text?.length || 0,
                textPreview: p.text?.substring(0, 50)
              })),
              fullParts: JSON.stringify(lastProcessedMsg?.parts, null, 2)
            },
            // After conversion
            modelMessage: {
              role: lastModelMsg?.role,
              contentType: typeof lastModelMsg?.content,
              contentLength: typeof lastModelMsg?.content === 'string' 
                ? lastModelMsg.content.length 
                : Array.isArray(lastModelMsg?.content) 
                  ? lastModelMsg.content.length 
                  : 0,
              contentPreview: typeof lastModelMsg?.content === 'string'
                ? lastModelMsg.content.substring(0, 100)
                : JSON.stringify(lastModelMsg?.content).substring(0, 200),
              fullContent: JSON.stringify(lastModelMsg, null, 2)
            }
          });

          const result = streamText({
            model: myProvider.languageModel(selectedChatModel),
            system: systemPromptText,
            messages: modelMessages,
            providerOptions, // Add provider options for thinking models
            stopWhen: stepCountIs(5),
            experimental_activeTools: activeTools,
            experimental_transform: smoothStream({ chunking: 'word' }),
            tools: shouldDisableTools ? {} : {
              getWeather,
              createDocument: createDocument({ session, dataStream }),
              updateDocument: updateDocument({ session, dataStream }),
              requestSuggestions: requestSuggestions({
                session,
                dataStream,
              }),
              writeToRAG: writeToRAG({ session, dataStream }),
              queryRAG: queryRAG({ session, dataStream }),
            },
            experimental_telemetry: {
              isEnabled: isProductionEnvironment,
              functionId: 'stream-text',
            },
          });

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
        const toolCalls = messages.filter(m => 
          m.parts?.some((p: any) => p.type === 'tool-call')
        );
        
        // Check BOTH the saved messages AND the original processed messages for file uploads
        const lastUserMessage = messages.filter(m => m.role === 'user').pop();
        const lastProcessedUserMessage = processedMessages?.filter(m => m.role === 'user').pop();
        
        const hasFileUpload = lastUserMessage?.parts?.some(p => 
          p.type === 'text' && 'text' in p && (p as { text: string }).text?.startsWith('File:')
        ) || lastProcessedUserMessage?.parts?.some(p => 
          p.type === 'text' && 'text' in p && (p as { text: string }).text?.startsWith('File:')
        );
        
        console.log('[ChatRoute] Stream finished', {
          totalMessages: messages.length,
          lastMessageRole: messages[messages.length - 1]?.role,
          hasToolCalls: toolCalls.length > 0,
          toolCallCount: toolCalls.length,
          toolNames: toolCalls.flatMap(m => 
            m.parts?.filter((p: any) => p.type === 'tool-call')
              .map((p: any) => p.toolName) || []
          ),
          hadFileUpload: hasFileUpload,
          expectedToolCall: hasFileUpload && toolCalls.length === 0 ? 'WARNING: File uploaded but no tool called!' : 'OK',
        });
        
        // If a file was uploaded but no tool was called, log error and notify user
        if (hasFileUpload && toolCalls.length === 0) {
          console.error('[ChatRoute] ERROR: File was uploaded but AI did not call createDocument tool');
          
          // Send an error message to the UI
          const errorMessage: ChatMessage = {
            id: generateUUID(),
            role: 'assistant',
            parts: [{
              type: 'text',
              text: '⚠️ I noticed you uploaded a file but I didn\'t process it correctly. Please try again or type "summarize the uploaded file" to trigger processing.'
            }],
            metadata: {
              createdAt: new Date().toISOString(),
            }
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
              const hasTextPart = parts.some(part => part.type === 'text');
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
      // biome-ignore lint/suspicious/noExplicitAny: Error type is unknown
      onError: (error: any) => {
        console.error('[Chat API] Stream processing error:', error);
        return (
          error?.message || 'An error occurred while processing your request'
        );
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
