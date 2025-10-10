import { simulateReadableStream } from 'ai';
import { MockLanguageModelV2 } from 'ai/test';

// Mock helper function to replace deleted test utility
function getResponseChunksByPrompt(prompt: any, isReasoning = false): any[] {
  // Return simple mock chunks for testing
  const baseChunks: any[] = [
    { type: 'text-delta', id: '1', delta: 'This is a ' },
    { type: 'text-delta', id: '1', delta: 'mock response' },
    {
      type: 'finish',
      finishReason: 'stop' as const,
      usage: {
        inputTokens: 10,
        outputTokens: 20,
        totalTokens: 30,
      },
    },
  ];

  if (isReasoning) {
    // Add reasoning chunks for reasoning model
    return [
      {
        type: 'text-delta',
        id: '0',
        delta: 'Thinking...',
        contentType: 'reasoning',
      },
      ...baseChunks,
    ];
  }

  return baseChunks;
}

export const chatModel = new MockLanguageModelV2({
  doGenerate: async () => ({
    rawCall: { rawPrompt: null, rawSettings: {} },
    finishReason: 'stop',
    usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
    content: [{ type: 'text', text: 'Hello, world!' }],
    warnings: [],
  }),
  doStream: async ({ prompt }) => ({
    stream: simulateReadableStream({
      chunkDelayInMs: 500,
      initialDelayInMs: 1000,
      chunks: getResponseChunksByPrompt(prompt),
    }),
    rawCall: { rawPrompt: null, rawSettings: {} },
  }),
});

export const reasoningModel = new MockLanguageModelV2({
  doGenerate: async () => ({
    rawCall: { rawPrompt: null, rawSettings: {} },
    finishReason: 'stop',
    usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
    content: [{ type: 'text', text: 'Hello, world!' }],
    warnings: [],
  }),
  doStream: async ({ prompt }) => ({
    stream: simulateReadableStream({
      chunkDelayInMs: 500,
      initialDelayInMs: 1000,
      chunks: getResponseChunksByPrompt(prompt, true),
    }),
    rawCall: { rawPrompt: null, rawSettings: {} },
  }),
});

export const titleModel = new MockLanguageModelV2({
  doGenerate: async () => ({
    rawCall: { rawPrompt: null, rawSettings: {} },
    finishReason: 'stop',
    usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
    content: [{ type: 'text', text: 'This is a test title' }],
    warnings: [],
  }),
  doStream: async () => ({
    stream: simulateReadableStream({
      chunkDelayInMs: 500,
      initialDelayInMs: 1000,
      chunks: [
        { type: 'text-delta', id: '1', delta: 'This is a test title' },
        {
          type: 'finish',
          finishReason: 'stop' as const,
          usage: {
            inputTokens: 3,
            outputTokens: 10,
            totalTokens: 13,
          },
        },
      ],
    }),
    rawCall: { rawPrompt: null, rawSettings: {} },
  }),
});

export const artifactModel = new MockLanguageModelV2({
  doGenerate: async () => ({
    rawCall: { rawPrompt: null, rawSettings: {} },
    finishReason: 'stop',
    usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
    content: [{ type: 'text', text: 'Hello, world!' }],
    warnings: [],
  }),
  doStream: async ({ prompt }) => ({
    stream: simulateReadableStream({
      chunkDelayInMs: 50,
      initialDelayInMs: 100,
      chunks: getResponseChunksByPrompt(prompt),
    }),
    rawCall: { rawPrompt: null, rawSettings: {} },
  }),
});
