import { generateObject } from 'ai';
import { z } from 'zod';
import { myProvider } from '../ai/providers';
import type { QueryMatch, RAGMetadata } from './types';

// Schema for LLM response - minimal to save tokens
const LLMRerankSchema = z.object({
  matches: z
    .array(
      z.object({
        id: z.string().describe('The ID of the match from the search results'),
        score: z
          .number()
          .min(0)
          .max(1)
          .describe('Relevance score between 0 and 1'),
        topicId: z
          .string()
          .optional()
          .describe('Optional ID of the topic group this match belongs to'),
        mergedIds: z
          .array(z.string())
          .optional()
          .describe('Optional array of IDs that were merged into this match'),
      }),
    )
    .describe('Array of matches to include, with scores and grouping'),
  topics: z
    .array(
      z.object({
        id: z.string().describe('Unique identifier for the topic group'),
        name: z
          .string()
          .describe('Short descriptive name for the topic (3-6 words)'),
      }),
    )
    .default([])
    .describe('Array of topic groups for organizing matches'),
});

export interface LLMRerankResult {
  matches: LLMRerankMatch[];
  content: string; // Formatted string for LLM consumption
  topicGroups: TopicGroup[];
}

export interface LLMRerankMatch {
  id: string;
  content: string;
  metadata: RAGMetadata;
  score: number; // LLM relevance score
  topicId?: string;
  merged?: string[]; // IDs that were merged
}

export interface TopicGroup {
  id: string;
  topic: string;
  matchIds: string[];
}

// Configuration for OpenAI reranking - using GPT-4.1-mini for optimal performance
const OPENAI_RERANK_CONFIG = {
  provider: 'openai' as const,
  modelFamily: 'gpt-4.1' as const, // Using GPT-4.1 family
  modelVariant: 'mini' as const, // Using mini for better balance of speed and quality
  textVerbosity: 'low' as const,
  reasoning_effort: 'low' as const, // Reduced to 'low' to disable reasoning overhead
  reasoningSummary: false, // No reasoning summary per user preference
} as const;

// Set to true to use OpenAI for reranking, false to use Anthropic
const USE_OPENAI_FOR_RERANKING = true;

const systemPrompt = `You are a JSON API that analyzes search results. You MUST return ONLY valid JSON output with no additional text.

YOUR MAIN TASKS:
1. DEDUPLICATE: Merge chunks that discuss the same topic/example (even with different timestamps)
2. SCORE: Rate relevance 0-1 based on query match
3. GROUP: Create 2-5 topic groups if >3 results
4. FILTER: Exclude results with score <0.3

DEDUPLICATION RULES:
- If chunks mention the SAME SPECIFIC EXAMPLE (like "workflow colon") = MERGE
- If same speaker discusses same topic within 2 minutes = MERGE
- If content overlap >50% = MERGE
- Keep best chunk as primary, list others in mergedIds

SCORING GUIDE:
- 0.8-1.0: Directly answers query
- 0.5-0.79: Related/useful context
- 0.3-0.49: Tangentially related
- 0.0-0.29: EXCLUDE (not relevant)

CRITICAL: Return ONLY JSON. No explanations. No markdown. Just the JSON object.`;

export async function rerankWithLLM(
  query: string,
  matches: QueryMatch[],
  options: {
    model?: string;
    maxMatches?: number;
  } = {},
): Promise<LLMRerankResult> {
  const startTime = Date.now();
  const maxMatches = options.maxMatches || 50;

  // Performance tracking
  const perfLog = (stage: string) => {
    const elapsed = Date.now() - startTime;
    console.log(`[LLM Reranker Performance] ${stage}: ${elapsed}ms`);
  };

  // Log which provider is being used
  console.log(
    `[LLM Reranker] Using ${USE_OPENAI_FOR_RERANKING ? `OpenAI GPT-5-${OPENAI_RERANK_CONFIG.modelVariant}` : 'Anthropic Claude'} for reranking`,
  );
  perfLog('Initialized');

  try {
    // Debug: Check if matches have content
    const matchesWithContent = matches.filter(
      (m) => m.content && m.content.length > 0,
    ).length;
    const matchesWithoutContent = matches.filter(
      (m) => !m.content || m.content.length === 0,
    ).length;
    console.log(
      `[LLM Reranker] Input matches: ${matchesWithContent} with content, ${matchesWithoutContent} without content`,
    );

    // Prepare matches for LLM analysis (truncate content to save tokens)
    const truncatedMatches = matches.map((m, idx) => ({
      index: idx + 1,
      id: m.id,
      document: m.metadata?.title || 'Unknown',
      type: m.metadata?.documentType || 'unknown',
      chunk: `${m.metadata?.chunkIndex || 0}/${m.metadata?.totalChunks || 1}`,
      speakers: m.metadata?.speakers?.join(', ') || '',
      // Truncate content but include beginning and end for context
      contentPreview:
        m.content && m.content.length > 800
          ? `${m.content.substring(0, 400)}...[truncated]...${m.content.substring(m.content.length - 400)}`
          : m.content || '[NO CONTENT]',
    }));

    // Build prompt for LLM
    const prompt = `Query: "${query}"

Search Results (${matches.length} total):
${truncatedMatches
  .slice(0, 30) // Limit to 30 results to avoid token limits
  .map(
    (m) => `
ID: ${m.id}
Document: ${m.document}
Type: ${m.type}
${m.speakers ? `Speakers: ${m.speakers}` : ''}
Content: ${m.contentPreview}`,
  )
  .join('\n---\n')}

IMPORTANT: Return ONLY a valid JSON object. Do not include any text before or after the JSON.

Analyze these ${matches.length} results and return JSON with this EXACT structure:
{
  "matches": [
    {
      "id": "doc1-chunk-1",
      "score": 0.85,
      "topicId": "topic1",
      "mergedIds": ["doc1-chunk-2", "doc1-chunk-3"]
    }
  ],
  "topics": [
    {
      "id": "topic1",
      "name": "Specific Topic Name"
    }
  ]
}

RULES:
- matches MUST be an array (use [] for empty)
- topics MUST be an array (use [] for empty)
- score MUST be a number between 0 and 1
- Include only results with score >= 0.3
- Merge similar/duplicate chunks
- Return up to ${maxMatches} results`;

    perfLog('Prompt prepared');

    // Generate structured output with OpenAI (default) or Claude based on const configuration

    // Use configuration const to determine provider
    const modelToUse = USE_OPENAI_FOR_RERANKING
      ? `openai-${OPENAI_RERANK_CONFIG.modelFamily}-${OPENAI_RERANK_CONFIG.modelVariant}-reranker` // Build model name from family and variant
      : options.model || 'reranker-model'; // Fallback to Claude

    console.log(`[LLM Reranker] Model selected: ${modelToUse}`);

    // Build provider options for OpenAI if needed
    const providerOptions = USE_OPENAI_FOR_RERANKING
      ? {
          openai: {
            textVerbosity: OPENAI_RERANK_CONFIG.textVerbosity,
            reasoning_effort: OPENAI_RERANK_CONFIG.reasoning_effort,
            // No reasoning summary based on configuration
          },
        }
      : undefined;

    perfLog('Config prepared');

    let object: {
      matches: Array<{
        id: string;
        score: number;
        topicId?: string;
        mergedIds?: string[];
      }>;
      topics: Array<{ id: string; name: string }>;
    };
    try {
      console.log(`[LLM Reranker] Starting generateObject call...`);
      perfLog('Before generateObject');

      const response = await generateObject({
        model: myProvider.languageModel(modelToUse),
        mode: 'json',
        system: systemPrompt,
        prompt,
        schema: LLMRerankSchema,
        temperature: 0.1, // Very low temperature for consistency
        ...(providerOptions && {
          experimental_providerMetadata: providerOptions,
        }),
      });

      perfLog('After generateObject');
      object = response.object;
    } catch (error) {
      console.error('[LLM Reranker] generateObject failed:', error);
      if (error instanceof Error) {
        console.error('[LLM Reranker] Error details:', {
          name: error.name,
          message: error.message,
          stack: error.stack?.split('\n').slice(0, 5).join('\n'),
        });

        // Log the actual response if available
        if (error.message.includes('Expected array, received string')) {
          console.error(
            '[LLM Reranker] Model returned string instead of JSON structure',
          );
        }
      }
      throw error;
    }

    // Create a map for quick lookup
    const matchesMap = new Map(matches.map((m) => [m.id, m]));

    console.log(`[LLM Reranker] Original matches count: ${matches.length}`);
    console.log(`[LLM Reranker] LLM returned ${object.matches.length} matches`);

    // Debug: Log first few IDs from both
    if (matches.length > 0) {
      console.log(
        `[LLM Reranker] Sample original IDs:`,
        matches.slice(0, 3).map((m) => m.id),
      );
    }
    if (object.matches.length > 0) {
      console.log(
        `[LLM Reranker] Sample LLM IDs:`,
        object.matches.slice(0, 3).map((m) => m.id),
      );
    }

    // Process LLM results
    const processedMatches: LLMRerankMatch[] = [];
    const seenIds = new Set<string>();

    // Filter and process matches based on LLM scoring
    const validMatches = object.matches.filter((m) => m.score >= 0.3);

    for (const llmMatch of validMatches) {
      if (seenIds.has(llmMatch.id)) continue;

      const originalMatch = matchesMap.get(llmMatch.id);
      if (!originalMatch) {
        console.warn(
          `[LLM Reranker] Warning: LLM returned ID '${llmMatch.id}' not found in original matches`,
        );
        continue;
      }

      // Debug content availability
      console.log(`[LLM Reranker] Processing match ${llmMatch.id}:`, {
        hasContent: !!originalMatch.content,
        contentLength: originalMatch.content?.length || 0,
        contentPreview:
          originalMatch.content?.substring(0, 100) || 'NO CONTENT',
      });

      seenIds.add(llmMatch.id);

      // If this match merged others, combine their content
      let finalContent = originalMatch.content;
      const mergedIds: string[] = [];

      if (llmMatch.mergedIds && llmMatch.mergedIds.length > 0) {
        const mergedContents: string[] = [originalMatch.content];

        for (const mergedId of llmMatch.mergedIds) {
          if (!seenIds.has(mergedId)) {
            seenIds.add(mergedId);
            mergedIds.push(mergedId);

            const mergedMatch = matchesMap.get(mergedId);
            if (mergedMatch) {
              mergedContents.push(mergedMatch.content);
            }
          }
        }

        // Combine content intelligently (remove overlaps)
        finalContent = combineContent(mergedContents);
      }

      const processedMatch = {
        id: llmMatch.id,
        content: finalContent,
        metadata: originalMatch.metadata,
        score: llmMatch.score,
        topicId: llmMatch.topicId,
        merged: mergedIds.length > 0 ? mergedIds : undefined,
      };

      // Debug log for content
      if (!finalContent || finalContent.trim().length === 0) {
        console.error(
          `[LLM Reranker] ERROR: No content for match ${llmMatch.id}`,
        );
        console.error(
          `[LLM Reranker] Original content length:`,
          originalMatch.content?.length || 0,
        );
        console.error(`[LLM Reranker] Merged IDs:`, mergedIds);
      }

      processedMatches.push(processedMatch);
    }

    // Sort by score descending
    processedMatches.sort((a, b) => b.score - a.score);

    // Create topic groups
    const topicGroups: TopicGroup[] = object.topics.map((t) => ({
      id: t.id,
      topic: t.name,
      matchIds: processedMatches
        .filter((m) => m.topicId === t.id)
        .map((m) => m.id),
    }));

    // Format content for LLM consumption
    const formattedContent = formatForLLM(processedMatches, topicGroups);

    // Final debug summary
    console.log(`[LLM Reranker] Final results:`, {
      processedCount: processedMatches.length,
      withContent: processedMatches.filter(
        (m) => m.content && m.content.length > 0,
      ).length,
      withoutContent: processedMatches.filter(
        (m) => !m.content || m.content.length === 0,
      ).length,
      totalContentLength: processedMatches.reduce(
        (sum, m) => sum + (m.content?.length || 0),
        0,
      ),
      topicGroups: topicGroups.length,
    });

    perfLog('Complete');

    return {
      matches: processedMatches,
      content: formattedContent,
      topicGroups,
    };
  } catch (error) {
    console.error('[LLM Reranker] Error:', error);
    throw error;
  }
}

/**
 * Combine multiple content strings, removing overlaps
 */
function combineContent(contents: string[]): string {
  if (contents.length === 0) return '';
  if (contents.length === 1) return contents[0];

  // Simple approach: look for overlapping endings/beginnings
  let combined = contents[0];

  for (let i = 1; i < contents.length; i++) {
    const current = contents[i];

    // Find overlap by checking if end of combined matches beginning of current
    let overlapFound = false;
    const minOverlap = 50; // Minimum characters to consider as overlap
    const maxOverlap = 200; // Maximum to check

    for (
      let len = Math.min(maxOverlap, combined.length, current.length);
      len >= minOverlap;
      len--
    ) {
      const endOfCombined = combined.slice(-len);
      const startOfCurrent = current.slice(0, len);

      if (endOfCombined === startOfCurrent) {
        // Found overlap, append only the non-overlapping part
        combined += current.slice(len);
        overlapFound = true;
        break;
      }
    }

    if (!overlapFound) {
      // No overlap found, just concatenate with a separator
      combined += `\n\n[...]\n\n${current}`;
    }
  }

  return combined;
}

/**
 * Format results for LLM consumption
 */
function formatForLLM(
  matches: LLMRerankMatch[],
  topicGroups: TopicGroup[],
): string {
  if (matches.length === 0) {
    return 'No relevant content found.';
  }

  let formatted = '';

  // Add grouped results first
  for (const group of topicGroups) {
    if (group.matchIds.length === 0) continue;

    formatted += `\n📚 **${group.topic}**\n`;
    formatted += `${'─'.repeat(40)}\n`;

    const groupMatches = matches.filter((m) => m.topicId === group.id);
    for (const match of groupMatches) {
      formatted += formatMatch(match, matches.indexOf(match) + 1);
    }
  }

  // Add ungrouped results
  const ungroupedMatches = matches.filter((m) => !m.topicId);
  if (ungroupedMatches.length > 0) {
    if (topicGroups.length > 0) {
      formatted += `\n📄 **Other Results**\n`;
      formatted += `${'─'.repeat(40)}\n`;
    }

    for (const match of ungroupedMatches) {
      formatted += formatMatch(match, matches.indexOf(match) + 1);
    }
  }

  // Add citation instructions
  const instructions = `When using this information, cite sources using [Source N] where N is the source number above.\n\n`;

  return instructions + formatted;
}

function formatMatch(match: LLMRerankMatch, index: number): string {
  const metadata = match.metadata;

  let citation = `📍 Source [${index}]: ${metadata.title || 'Unknown Document'}`;

  if (metadata.documentType) {
    citation += ` | Type: ${metadata.documentType}`;
  }

  if (metadata.speakers && metadata.speakers.length > 0) {
    citation += ` | Speakers: ${metadata.speakers.join(', ')}`;
  }

  if (metadata.sectionTitle || metadata.topic) {
    citation += ` | Section: ${metadata.sectionTitle || metadata.topic}`;
  }

  if (metadata.meetingDate || metadata.createdAt) {
    const date = metadata.meetingDate || metadata.createdAt;
    const dateStr =
      typeof date === 'string'
        ? date.split('T')[0]
        : new Date(date).toISOString().split('T')[0];
    citation += ` | Date: ${dateStr}`;
  }

  citation += ` | Relevance: ${(match.score * 100).toFixed(0)}%`;

  if (match.merged && match.merged.length > 0) {
    citation += ` | Merged ${match.merged.length} chunks`;
  }

  return `${citation}\n\n${match.content}\n\n`;
}
