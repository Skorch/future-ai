import { generateObject } from 'ai';
import { z } from 'zod';
import type {
  TranscriptItem,
  ChunkResult,
  ChunkOptions,
} from '../../rag/types';
import { myProvider } from '../providers';

// Schema for LLM response - array of topic segments
const chunkingSchema = z.object({
  chunks: z
    .array(
      z.object({
        topic: z.string().describe('The topic discussed in this segment'),
        startIdx: z
          .number()
          .int()
          .min(0)
          .describe('Starting index (inclusive)'),
        endIdx: z.number().int().min(0).describe('Ending index (inclusive)'),
      }),
    )
    .min(1)
    .describe('Array of contiguous topic segments'),
});

type TopicChunk = z.infer<typeof chunkingSchema>['chunks'][0];

/**
 * Chunks transcript items into topic-based segments
 * Sends entire conversation to LLM for intelligent topic boundary detection
 */
export async function chunkTranscriptItems(
  items: TranscriptItem[],
  topics: string[],
  options: ChunkOptions = {},
): Promise<ChunkResult[]> {
  const { model = 'claude-sonnet-4', dryRun = false } = options;

  // Handle empty input
  if (items.length === 0) {
    return [];
  }

  // Get topic chunks from LLM or fallback
  const chunks = await getTopicChunks(items, topics, model, dryRun);

  // Convert to ChunkResult format
  return convertToChunkResults(chunks, items);
}

/**
 * Get topic chunks from LLM or fallback
 */
async function getTopicChunks(
  items: TranscriptItem[],
  topics: string[],
  model: string,
  dryRun: boolean,
): Promise<TopicChunk[]> {
  if (dryRun) {
    return createFallbackChunks(items, topics);
  }

  try {
    const result = await generateObject({
      model: myProvider.languageModel(model),
      schema: chunkingSchema,
      prompt: buildChunkingPrompt(items, topics),
    });

    // Validate and fix if needed
    return validateAndFixChunks(result.object.chunks, items.length);
  } catch (error) {
    console.error('AI chunking failed, using fallback:', error);
    return createFallbackChunks(items, topics);
  }
}

/**
 * Convert topic chunks to ChunkResult format
 */
function convertToChunkResults(
  chunks: TopicChunk[],
  items: TranscriptItem[],
): ChunkResult[] {
  return chunks.map((chunk) => {
    const chunkItems = items.slice(chunk.startIdx, chunk.endIdx + 1);
    return {
      topic: chunk.topic,
      startIdx: chunk.startIdx,
      endIdx: chunk.endIdx,
      content: createContent(chunkItems),
      metadata: {
        startTime: chunkItems[0].timecode,
        endTime: chunkItems[chunkItems.length - 1].timecode,
        speakers: [...new Set(chunkItems.map((i) => i.speaker))],
      },
    };
  });
}

/**
 * Build the prompt for the LLM
 */
function buildChunkingPrompt(
  items: TranscriptItem[],
  topics: string[],
): string {
  const formattedItems = items
    .map((item, idx) => `[${idx}] ${item.speaker}: ${item.text}`)
    .join('\n');

  return `Analyze this conversation and segment it into topically coherent chunks.

AVAILABLE TOPICS:
${topics.map((t) => `- ${t}`).join('\n')}
- General Discussion (use when no specific topic fits)

CRITICAL RULES:
1. Every chunk must have startIdx and endIdx (inclusive)
2. Chunks must be CONTIGUOUS: chunk[i].endIdx + 1 == chunk[i+1].startIdx
3. First chunk must start at 0, last chunk must end at ${items.length - 1}
4. NO GAPS: Every index from 0 to ${items.length - 1} must be in exactly one chunk
5. Topics CAN REPEAT if conversation returns to them (A→B→A = 3 separate chunks)
6. Prefer natural topic boundaries over size constraints

EXAMPLE:
Input conversation:
[0] Alice: Let's discuss the budget
[1] Bob: Marketing went over by 15%
[2] Alice: Now about the new feature
[3] Bob: Authentication is ready
[4] Alice: Going back to budget - what about Q3?
[5] Bob: Q3 looks better

Correct output:
{
  "chunks": [
    {"topic": "Budget", "startIdx": 0, "endIdx": 1},
    {"topic": "Product Development", "startIdx": 2, "endIdx": 3},
    {"topic": "Budget", "startIdx": 4, "endIdx": 5}
  ]
}

CONVERSATION TO SEGMENT:
${formattedItems}

Look for:
- Topic transitions ("let's discuss", "moving on", "regarding", "about")
- Natural conversation shifts
- Questions that change subject
- Returns to previous topics

Return ONLY valid JSON with this structure:
{"chunks": [{"topic": "...", "startIdx": N, "endIdx": M}, ...]}

VERIFY: 
- First chunk must start at 0
- Last chunk must end at ${items.length - 1}
- All chunks connected with no gaps`;
}

/**
 * Create content string from items
 */
function createContent(items: TranscriptItem[]): string {
  return items
    .map((item) => `[${item.timecode}s] ${item.speaker}: ${item.text}`)
    .join('\n');
}

/**
 * Validate chunks and fix common issues
 */
function validateAndFixChunks(
  chunks: TopicChunk[],
  totalItems: number,
): TopicChunk[] {
  if (chunks.length === 0) {
    return [
      {
        topic: 'General Discussion',
        startIdx: 0,
        endIdx: totalItems - 1,
      },
    ];
  }

  const fixed = [...chunks];

  // Ensure first chunk starts at 0
  if (fixed[0].startIdx !== 0) {
    console.warn(`Fixing first chunk start: ${fixed[0].startIdx} -> 0`);
    fixed[0].startIdx = 0;
  }

  // Fix gaps between chunks
  for (let i = 1; i < fixed.length; i++) {
    const expectedStart = fixed[i - 1].endIdx + 1;
    if (fixed[i].startIdx !== expectedStart) {
      console.warn(
        `Fixing gap at chunk ${i}: ${fixed[i].startIdx} -> ${expectedStart}`,
      );
      fixed[i].startIdx = expectedStart;
    }
  }

  // Ensure last chunk ends at totalItems - 1
  const lastChunk = fixed[fixed.length - 1];
  if (lastChunk.endIdx !== totalItems - 1) {
    console.warn(
      `Fixing last chunk end: ${lastChunk.endIdx} -> ${totalItems - 1}`,
    );
    lastChunk.endIdx = totalItems - 1;
  }

  return fixed;
}

/**
 * Create fallback chunks for dry-run or error cases
 */
function createFallbackChunks(
  items: TranscriptItem[],
  topics: string[],
): TopicChunk[] {
  if (items.length === 0) return [];

  const chunks: TopicChunk[] = [];
  const targetSize = Math.min(
    30,
    Math.max(5, Math.ceil(items.length / topics.length)),
  );

  let currentIdx = 0;
  let topicIdx = 0;

  while (currentIdx < items.length) {
    let endIdx = Math.min(currentIdx + targetSize - 1, items.length - 1);

    // Look for natural boundaries (speaker changes or time gaps)
    if (endIdx < items.length - 1) {
      for (let i = endIdx; i > currentIdx + 3; i--) {
        if (
          items[i].speaker !== items[i - 1].speaker ||
          items[i].timecode - items[i - 1].timecode > 30
        ) {
          endIdx = i - 1;
          break;
        }
      }
    }

    chunks.push({
      topic: topics[topicIdx % topics.length],
      startIdx: currentIdx,
      endIdx: endIdx,
    });

    currentIdx = endIdx + 1;
    topicIdx++;
  }

  return chunks;
}
