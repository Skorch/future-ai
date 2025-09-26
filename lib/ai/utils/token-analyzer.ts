import type { CoreMessage } from 'ai';
import { getLogger } from '@/lib/logger';

const logger = getLogger('TokenAnalyzer');

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
  iterationNumber?: number,
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
        } else if (
          'type' in part &&
          part.type === 'tool-result' &&
          'result' in part
        ) {
          const toolResultSize = JSON.stringify(
            (part as { result: unknown }).result,
          ).length;
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
  const utilizationPercent = Math.round(
    (totalEstimatedTokens / modelLimit) * 100,
  );
  const isOverLimit = totalEstimatedTokens > modelLimit;
  const isApproachingLimit = totalEstimatedTokens > 150000;

  // Get largest messages - map to expected structure
  const largestMessages = [...messageStats]
    .sort((a, b) => b.estimatedTokens - a.estimatedTokens)
    .slice(0, 5)
    .map((msg) => ({
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

export function logTokenStats(
  stats: TokenStats,
  iterationNumber?: number,
): void {
  const iteration = iterationNumber || 'Current';

  logger.debug(
    `\n========== TOKEN USAGE STATS (Iteration: ${iteration}) ==========`,
  );
  logger.debug(
    `Total Tokens: ${stats.totalTokens.toLocaleString()} / 200,000 (${stats.utilizationPercent}% used)`,
  );
  logger.debug(`Remaining: ${stats.remaining.toLocaleString()} tokens`);
  logger.debug(
    `Status: ${stats.isOverLimit ? '⛔ OVER LIMIT' : stats.isApproachingLimit ? '⚠️  APPROACHING LIMIT' : '✅ OK'}`,
  );
  logger.debug('Breakdown:');
  logger.debug(
    `  - System Prompt: ${stats.systemPromptTokens.toLocaleString()} tokens`,
  );
  logger.debug(
    `  - User Messages: ${stats.userTokens.toLocaleString()} tokens`,
  );
  logger.debug(
    `  - Assistant Messages: ${stats.assistantTokens.toLocaleString()} tokens`,
  );
  logger.debug(`  - Total Messages: ${stats.messageCount}`);
  logger.debug('=====================================================\n');

  if (stats.isOverLimit) {
    logger.error(
      '\n⛔⛔⛔ TOKEN LIMIT EXCEEDED - REQUEST WILL LIKELY FAIL ⛔⛔⛔',
    );
    logger.error('TOP 5 LARGEST MESSAGES:');
    stats.largestMessages.forEach((msg, idx) => {
      logger.error(
        `  ${idx + 1}. Message #${msg.index} (${msg.role}): ${msg.tokens.toLocaleString()} tokens`,
      );
      // Remove preview content in production to avoid logging user data
      logger.debug(`     Preview: "${msg.preview}..."`);
    });
    logger.error('\nRECOMMENDATIONS:');
    logger.error('  1. Start a new chat');
    logger.error('  2. Use loadDocument with maxChars parameter');
    logger.error('  3. Load fewer documents at once');
    logger.error(
      '⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔\n',
    );
  }
}

export function logTokenGrowth(
  beforeTokens: number,
  afterTokens: number,
  operation: string,
): void {
  const growth = afterTokens - beforeTokens;
  const percentGrowth =
    beforeTokens > 0 ? Math.round((growth / beforeTokens) * 100) : 0;

  logger.debug(`[Token Growth] ${operation}:`);
  logger.debug(`  Before: ${beforeTokens.toLocaleString()} tokens`);
  logger.debug(`  After: ${afterTokens.toLocaleString()} tokens`);
  logger.debug(
    `  Growth: +${growth.toLocaleString()} tokens (${percentGrowth}% increase)`,
  );
}
