import type { CoreMessage } from 'ai';

interface TokenStats {
  totalTokens: number;
  systemPromptTokens: number;
  userTokens: number;
  assistantTokens: number;
  messageCount: number;
  utilizationPercent: number;
  remaining: number;
  isOverLimit: boolean;
  isApproachingLimit: boolean;
  largestMessages: Array<{
    index: number;
    role: string;
    tokens: number;
    preview: string;
  }>;
}

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function analyzeTokenUsage(
  systemPrompt: string,
  modelMessages: CoreMessage[],
  iterationNumber?: number
): TokenStats {
  let totalCharacters = 0;
  let totalEstimatedTokens = 0;

  // Add system prompt
  const systemPromptTokens = estimateTokens(systemPrompt);
  totalCharacters += systemPrompt.length;
  totalEstimatedTokens += systemPromptTokens;

  // Analyze each message
  const messageStats: Array<{
    index: number;
    role: string;
    characters: number;
    estimatedTokens: number;
    preview: string;
  }> = [];

  let userTokens = 0;
  let assistantTokens = 0;

  modelMessages.forEach((msg, idx) => {
    let msgChars = 0;
    let msgContent = '';

    if (typeof msg.content === 'string') {
      msgChars = msg.content.length;
      msgContent = msg.content;
    } else if (Array.isArray(msg.content)) {
      msg.content.forEach((part) => {
        if (part.type === 'text' && part.text) {
          msgChars += part.text.length;
          msgContent += part.text;
        } else if (part.type === 'image' && part.image) {
          const imageSize =
            typeof part.image === 'string'
              ? part.image.length
              : JSON.stringify(part.image).length;
          msgChars += imageSize;
          msgContent += `[IMAGE: ${imageSize} chars]`;
        } else if ((part as any).type === 'tool-result' && (part as any).result) {
          const toolResultSize = JSON.stringify((part as any).result).length;
          msgChars += toolResultSize;
          msgContent += `[TOOL_RESULT: ${toolResultSize} chars]`;
        }
      });
    }

    totalCharacters += msgChars;
    const msgTokens = estimateTokens(msgContent);
    totalEstimatedTokens += msgTokens;

    if (msg.role === 'user') userTokens += msgTokens;
    if (msg.role === 'assistant') assistantTokens += msgTokens;

    messageStats.push({
      index: idx,
      role: msg.role,
      characters: msgChars,
      estimatedTokens: msgTokens,
      preview: msgContent.substring(0, 100),
    });
  });

  const modelLimit = 200000;
  const utilizationPercent = Math.round((totalEstimatedTokens / modelLimit) * 100);
  const isOverLimit = totalEstimatedTokens > modelLimit;
  const isApproachingLimit = totalEstimatedTokens > 150000;

  // Get largest messages - map to expected structure
  const largestMessages = [...messageStats]
    .sort((a, b) => b.estimatedTokens - a.estimatedTokens)
    .slice(0, 5)
    .map(msg => ({
      index: msg.index,
      role: msg.role,
      tokens: msg.estimatedTokens, // Rename estimatedTokens to tokens
      preview: msg.preview,
    }));

  return {
    totalTokens: totalEstimatedTokens,
    systemPromptTokens,
    userTokens,
    assistantTokens,
    messageCount: modelMessages.length,
    utilizationPercent,
    remaining: modelLimit - totalEstimatedTokens,
    isOverLimit,
    isApproachingLimit,
    largestMessages,
  };
}

export function logTokenStats(stats: TokenStats, iterationNumber?: number): void {
  const iteration = iterationNumber || 'Current';

  console.log(`\n========== TOKEN USAGE STATS (Iteration: ${iteration}) ==========`);
  console.log(`Total Tokens: ${stats.totalTokens.toLocaleString()} / 200,000 (${stats.utilizationPercent}% used)`);
  console.log(`Remaining: ${stats.remaining.toLocaleString()} tokens`);
  console.log(`Status: ${stats.isOverLimit ? '⛔ OVER LIMIT' : stats.isApproachingLimit ? '⚠️  APPROACHING LIMIT' : '✅ OK'}`);
  console.log('Breakdown:');
  console.log(`  - System Prompt: ${stats.systemPromptTokens.toLocaleString()} tokens`);
  console.log(`  - User Messages: ${stats.userTokens.toLocaleString()} tokens`);
  console.log(`  - Assistant Messages: ${stats.assistantTokens.toLocaleString()} tokens`);
  console.log(`  - Total Messages: ${stats.messageCount}`);
  console.log('=====================================================\n');

  if (stats.isOverLimit) {
    console.error('\n⛔⛔⛔ TOKEN LIMIT EXCEEDED - REQUEST WILL LIKELY FAIL ⛔⛔⛔');
    console.error('TOP 5 LARGEST MESSAGES:');
    stats.largestMessages.forEach((msg, idx) => {
      console.error(`  ${idx + 1}. Message #${msg.index} (${msg.role}): ${msg.tokens.toLocaleString()} tokens`);
      console.error(`     Preview: "${msg.preview}..."`);
    });
    console.error('\nRECOMMENDATIONS:');
    console.error('  1. Start a new chat');
    console.error('  2. Use loadDocument with maxChars parameter');
    console.error('  3. Load fewer documents at once');
    console.error('⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔\n');
  }
}

export function logTokenGrowth(
  beforeTokens: number,
  afterTokens: number,
  operation: string
): void {
  const growth = afterTokens - beforeTokens;
  const percentGrowth = beforeTokens > 0 ? Math.round((growth / beforeTokens) * 100) : 0;

  console.log(`[Token Growth] ${operation}:`);
  console.log(`  Before: ${beforeTokens.toLocaleString()} tokens`);
  console.log(`  After: ${afterTokens.toLocaleString()} tokens`);
  console.log(`  Growth: +${growth.toLocaleString()} tokens (${percentGrowth}% increase)`);
}