import { getLogger } from '@/lib/logger';

const logger = getLogger('MeetingSummary');
import { smoothStream, streamText } from 'ai';
import { myProvider } from '@/lib/ai/providers';
import { createDocumentHandler } from '@/lib/artifacts/server';
import { getDocumentById } from '@/lib/db/queries';
import { metadata } from './metadata';
import { ARTIFACT_SYSTEM_PROMPT } from '@/lib/ai/prompts/artifact-system';

// Type definitions for meeting summary metadata
interface MeetingSummaryMetadata {
  transcript?: string;
  sourceDocumentIds?: string[];
  meetingDate?: string;
  participants?: string[];
}

export const meetingSummaryHandler = createDocumentHandler<'text'>({
  kind: 'text',
  metadata,
  onCreateDocument: async ({
    title,
    dataStream,
    metadata: docMetadata,
    workspaceId,
  }) => {
    const handlerStartTime = Date.now();
    // Cast metadata to our expected type
    const typedMetadata = docMetadata as MeetingSummaryMetadata | undefined;
    logger.debug('[MeetingSummaryHandler] Starting document creation', {
      title,
      hasTranscript: !!typedMetadata?.transcript,
      transcriptLength: typedMetadata?.transcript?.length || 0,
      sourceDocumentIds: typedMetadata?.sourceDocumentIds,
      meetingDate: typedMetadata?.meetingDate,
      participants: typedMetadata?.participants,
      startTime: new Date(handlerStartTime).toISOString(),
    });

    let draftContent = '';
    let transcript = '';

    // Check if we have sourceDocumentIds to fetch from
    if (
      typedMetadata?.sourceDocumentIds?.length &&
      typedMetadata.sourceDocumentIds.length > 0
    ) {
      logger.debug(
        '[MeetingSummaryHandler] Fetching source documents:',
        typedMetadata.sourceDocumentIds,
      );

      // Fetch source documents
      const sourceDocuments = await Promise.all(
        typedMetadata.sourceDocumentIds.map((docId) =>
          getDocumentById({ id: docId, workspaceId }),
        ),
      );

      // Validate all documents exist and have content
      const validDocuments = sourceDocuments.filter(
        (doc): doc is NonNullable<typeof doc> =>
          doc?.content !== null && doc?.content !== undefined,
      );
      if (validDocuments.length === 0) {
        throw new Error('No valid source documents found');
      }

      // Combine transcripts from source documents
      transcript = validDocuments
        .map((doc) => `\n--- ${doc.title} ---\n${doc.content}\n`)
        .join('\n');

      logger.debug(
        '[MeetingSummaryHandler] Combined transcripts from',
        validDocuments.length,
        'documents',
        {
          transcriptLength: transcript.length,
          estimatedTokens: Math.ceil(transcript.length / 4),
          elapsedSoFar: Date.now() - handlerStartTime,
        },
      );
    } else {
      // Summaries MUST have source documents
      throw new Error(
        'Meeting summaries require sourceDocumentIds to fetch transcript content',
      );
    }

    const meetingDate =
      typedMetadata?.meetingDate || new Date().toISOString().split('T')[0];
    const participants = typedMetadata?.participants || [];

    logger.debug(
      '[MeetingSummaryHandler] Preparing to stream with artifact-model',
      {
        elapsedBeforeStream: Date.now() - handlerStartTime,
      },
    );

    // Compose: Artifact system prompt + Meeting summary specific instructions + Template
    const systemPrompt = [
      ARTIFACT_SYSTEM_PROMPT,
      '\n## Document Type Specific Instructions\n',
      metadata.prompt,
      '\n## Required Output Format\n',
      metadata.template,
    ]
      .filter(Boolean)
      .join('\n');

    const { fullStream } = streamText({
      model: myProvider.languageModel('artifact-model'),
      system: systemPrompt,
      maxOutputTokens: 8192, // Testing if token limit affects verbosity
      experimental_transform: smoothStream({ chunking: 'word' }),
      prompt: `Create a comprehensive meeting summary from this transcript:

Meeting Date: ${meetingDate}
Participants: ${participants.join(', ')}

Transcript:
${transcript}`,
    });

    let chunkCount = 0;
    const streamStartTime = Date.now();
    logger.debug('[MeetingSummaryHandler] Starting stream processing', {
      elapsedBeforeStream: streamStartTime - handlerStartTime,
    });

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
          const streamElapsed = Date.now() - streamStartTime;
          logger.debug(
            `[MeetingSummaryHandler] Streamed ${chunkCount} chunks, ${draftContent.length} chars total`,
            {
              streamDuration: streamElapsed,
              streamSeconds: (streamElapsed / 1000).toFixed(2),
            },
          );
        }
      }
    }

    const totalDuration = Date.now() - handlerStartTime;
    const streamDuration = Date.now() - streamStartTime;
    logger.debug('[MeetingSummaryHandler] Stream completed', {
      totalChunks: chunkCount,
      contentLength: draftContent.length,
      firstChars: draftContent.substring(0, 100),
      streamDuration,
      streamSeconds: (streamDuration / 1000).toFixed(2),
      totalDuration,
      totalSeconds: (totalDuration / 1000).toFixed(2),
    });

    return draftContent;
  },
  onUpdateDocument: async ({ document, description, dataStream }) => {
    // Reuse the text handler's update logic for now
    let draftContent = '';

    const { fullStream } = streamText({
      model: myProvider.languageModel('artifact-model'),
      system: `You are editing a meeting summary. Maintain the structured format with Date, Participants, Topics, Key Decisions, and Action Items sections. Current content:\n${document.content}`,
      maxOutputTokens: 8192, // Testing if token limit affects verbosity
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
