import type {
  TranscriptItem,
  ChunkResult,
  QueryMatch,
} from '../../lib/rag/types';

// Expected outputs for parsing tests
export const expectedWebVTTOutput: TranscriptItem[] = [
  {
    timecode: 0,
    speaker: 'Speaker 1',
    text: 'Hello, welcome to the meeting.',
  },
  {
    timecode: 5,
    speaker: 'Speaker 2',
    text: 'Thank you for having me.',
  },
];

export const expectedFathomOutput: TranscriptItem[] = [
  {
    timecode: 0,
    speaker: 'John Doe',
    text: 'Opening remarks for the presentation.',
  },
  {
    timecode: 120,
    speaker: 'Jane Smith',
    text: 'Following up with additional context.',
  },
];

// Expected outputs for chunking tests
export const expectedChunkOutput: ChunkResult[] = [
  {
    topic: 'Planning',
    startIdx: 0,
    endIdx: 4,
    content: 'Combined content from planning discussion.',
    metadata: {
      startTime: 0,
      endTime: 40,
      speakers: ['Speaker 1', 'Speaker 2'],
    },
  },
];

// Expected outputs for query tests
export const expectedQueryMatches: QueryMatch[] = [
  {
    id: 'match-001',
    score: 0.95,
    content: 'Highly relevant content about cloud migration.',
    metadata: {
      source: 'meeting.vtt',
      type: 'transcript',
      topic: 'Technical',
      createdAt: new Date().toISOString(),
    },
  },
  {
    id: 'match-002',
    score: 0.82,
    content: 'Related discussion about infrastructure.',
    metadata: {
      source: 'meeting.vtt',
      type: 'transcript',
      topic: 'Technical',
      createdAt: new Date().toISOString(),
    },
  },
];

// Expected error scenarios
export const expectedParsingErrors = {
  emptyFile: 'Unsupported format. Expected WebVTT or Fathom.',
  malformedWebVTT: 'Invalid WebVTT format',
  malformedFathom: 'Invalid Fathom format',
};

export const expectedChunkingErrors = {
  emptyTranscript: 'Cannot chunk empty transcript',
  invalidChunkSize: 'Chunk size must be positive',
};

// Expected validation results
export const expectedValidationResults = {
  validTranscriptItem: true,
  invalidTranscriptItem: false,
  validRAGDocument: true,
  invalidRAGDocument: false,
};
