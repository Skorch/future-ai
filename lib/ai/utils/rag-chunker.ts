import { generateObject } from 'ai';
import type {
  TranscriptItem,
  ChunkResult,
  ChunkOptions,
} from '../../rag/types';
import { chunkSchema } from '../../rag/types';
import { myProvider } from '../providers';

export async function chunkTranscriptItems(
  items: TranscriptItem[],
  topics: string[],
  options: ChunkOptions = {},
): Promise<ChunkResult[]> {
  const { chunkSize = 20, model = 'claude-sonnet-4', dryRun = false } = options;

  const chunks: ChunkResult[] = [];

  // Simple sequential processing - no overlaps needed for now
  for (let i = 0; i < items.length; i += chunkSize) {
    const batch = items.slice(i, Math.min(i + chunkSize, items.length));

    // For dry-run, just assign topics round-robin
    if (dryRun) {
      chunks.push(
        createChunkResult(
          batch,
          topics[chunks.length % topics.length],
          i,
          Math.min(i + chunkSize - 1, items.length - 1),
        ),
      );
      continue;
    }

    // Real AI chunking - let the model handle topic assignment
    try {
      const result = await generateObject({
        model: myProvider.languageModel(model),
        schema: chunkSchema,
        prompt: buildChunkingPrompt(batch, topics),
      });

      chunks.push(
        createChunkResult(batch, result.object.topic, i, i + batch.length - 1),
      );
    } catch (error) {
      // Fallback to general topic if AI fails
      console.error('AI chunking failed, using fallback:', error);
      chunks.push(
        createChunkResult(batch, 'General Discussion', i, i + batch.length - 1),
      );
    }
  }

  return chunks;
}

function buildChunkingPrompt(
  items: TranscriptItem[],
  topics: string[],
): string {
  return `Identify the main topic for this conversation segment.

Available topics: ${topics.join(', ')}, or "General Discussion" if none fit well.

Conversation:
${items.map((item) => `${item.speaker}: ${item.text}`).join('\n')}

Return the most relevant topic and optionally a brief summary.`;
}

function createChunkResult(
  items: TranscriptItem[],
  topic: string,
  startIdx: number,
  endIdx: number,
): ChunkResult {
  const content = items
    .map((item) => `[${item.timecode}s] ${item.speaker}: ${item.text}`)
    .join('\n');

  return {
    topic,
    startIdx,
    endIdx,
    content,
    metadata: {
      startTime: items[0].timecode,
      endTime: items[items.length - 1].timecode,
      speakers: [...new Set(items.map((i) => i.speaker))],
    },
  };
}
