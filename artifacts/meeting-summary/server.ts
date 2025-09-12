import { smoothStream, streamText } from 'ai';
import { myProvider } from '@/lib/ai/providers';
import { createDocumentHandler } from '@/lib/artifacts/server';

export const meetingSummaryHandler = createDocumentHandler<'text'>({
  kind: 'text',
  onCreateDocument: async ({ title, dataStream, metadata }) => {
    console.log('[MeetingSummaryHandler] Starting document creation', {
      title,
      hasTranscript: !!metadata?.transcript,
      transcriptLength: metadata?.transcript?.length || 0,
      meetingDate: metadata?.meetingDate,
      participants: metadata?.participants,
    });

    let draftContent = '';

    // Extract transcript from metadata
    const transcript = metadata?.transcript || '';
    const meetingDate = metadata?.meetingDate || new Date().toISOString().split('T')[0];
    const participants = metadata?.participants || [];

    console.log('[MeetingSummaryHandler] Preparing to stream with artifact-model');

    const { fullStream } = streamText({
      model: myProvider.languageModel('artifact-model'),
      system: `You are a meeting intelligence assistant. Generate a structured meeting summary with the following format:
# Meeting Summary: ${title}
**Date:** ${meetingDate}
**Participants:** ${participants.join(', ')}
**Duration:** [Extract from transcript if available]

## Executive Overview
[2-3 sentence high-level summary]

## Topic: [First Major Discussion Topic]
- Key points with detail
- Decisions or conclusions
- Action items with owners

## Topic: [Second Major Discussion Topic]
[Continue pattern for all major topics]

## Key Decisions
1. Clear, actionable decisions with context

## Action Items
| Owner | Task | Due Date |
|-------|------|----------|
| [Name] | [Task] | [Date] |

Focus on extracting actionable insights and decisions. Use "## Topic:" format for each discussion topic.`,
      experimental_transform: smoothStream({ chunking: 'word' }),
      prompt: `Create a comprehensive meeting summary from this transcript:\n\n${transcript}`,
    });

    let chunkCount = 0;
    console.log('[MeetingSummaryHandler] Starting stream processing');

    for await (const delta of fullStream) {
      const { type } = delta;

      if (type === 'text-delta') {
        const { text } = delta;
        chunkCount++;

        draftContent += text;

        dataStream.write({
          type: 'data-textDelta',
          data: text,
          transient: true,
        });

        // Log every 10th chunk to avoid spam
        if (chunkCount % 10 === 0) {
          console.log(`[MeetingSummaryHandler] Streamed ${chunkCount} chunks, ${draftContent.length} chars total`);
        }
      }
    }

    console.log('[MeetingSummaryHandler] Stream completed', {
      totalChunks: chunkCount,
      contentLength: draftContent.length,
      firstChars: draftContent.substring(0, 100),
    });

    return draftContent;
  },
  onUpdateDocument: async ({ document, description, dataStream }) => {
    // Reuse the text handler's update logic for now
    let draftContent = '';

    const { fullStream } = streamText({
      model: myProvider.languageModel('artifact-model'),
      system: `You are editing a meeting summary. Maintain the structured format with Date, Participants, Topics, Key Decisions, and Action Items sections. Current content:\n${document.content}`,
      experimental_transform: smoothStream({ chunking: 'word' }),
      prompt: description,
    });

    for await (const delta of fullStream) {
      const { type } = delta;

      if (type === 'text-delta') {
        const { text } = delta;

        draftContent += text;

        dataStream.write({
          type: 'data-textDelta',
          data: text,
          transient: true,
        });
      }
    }

    return draftContent;
  },
});