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
  onCreateDocument: async ({ title, dataStream, metadata: docMetadata }) => {
    // Cast metadata to our expected type
    const typedMetadata = docMetadata as MeetingSummaryMetadata | undefined;
    console.log('[MeetingSummaryHandler] Starting document creation', {
      title,
      hasTranscript: !!typedMetadata?.transcript,
      transcriptLength: typedMetadata?.transcript?.length || 0,
      sourceDocumentIds: typedMetadata?.sourceDocumentIds,
      meetingDate: typedMetadata?.meetingDate,
      participants: typedMetadata?.participants,
    });

    let draftContent = '';
    let transcript = '';

    // Check if we have sourceDocumentIds to fetch from
    if (
      typedMetadata?.sourceDocumentIds?.length &&
      typedMetadata.sourceDocumentIds.length > 0
    ) {
      console.log(
        '[MeetingSummaryHandler] Fetching source documents:',
        typedMetadata.sourceDocumentIds,
      );

      // Fetch source documents
      const sourceDocuments = await Promise.all(
        typedMetadata.sourceDocumentIds.map((docId) =>
          getDocumentById({ id: docId }),
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

      console.log(
        '[MeetingSummaryHandler] Combined transcripts from',
        validDocuments.length,
        'documents',
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

    console.log(
      '[MeetingSummaryHandler] Preparing to stream with artifact-model',
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
          console.log(
            `[MeetingSummaryHandler] Streamed ${chunkCount} chunks, ${draftContent.length} chars total`,
          );
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
