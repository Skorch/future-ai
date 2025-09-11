import type { ChunkResult, RAGDocument } from '../../lib/rag/types';

export const mockChunkResults: ChunkResult[] = [
  {
    topic: 'Planning',
    startIdx: 0,
    endIdx: 2,
    content: `[0s] John Doe: Welcome everyone to our quarterly planning meeting.
[5s] Jane Smith: Thank you, John. Let's start with the budget review.
[12s] John Doe: Our Q1 budget shows a 15% increase in operational costs.`,
    metadata: {
      startTime: 0,
      endTime: 12,
      speakers: ['John Doe', 'Jane Smith'],
    },
  },
  {
    topic: 'Technical',
    startIdx: 3,
    endIdx: 4,
    content: `[20s] Bob Johnson: We need to discuss the technical infrastructure upgrades.
[28s] Jane Smith: The cloud migration is our top priority this quarter.`,
    metadata: {
      startTime: 20,
      endTime: 28,
      speakers: ['Bob Johnson', 'Jane Smith'],
    },
  },
];

export const mockRAGDocuments: RAGDocument[] = [
  {
    id: 'doc-001',
    content:
      'Quarterly planning meeting discussing budget and technical infrastructure.',
    metadata: {
      source: 'meeting-2024-q1.vtt',
      type: 'transcript',
      topic: 'Planning',
      speakers: ['John Doe', 'Jane Smith'],
      startTime: 0,
      endTime: 12,
      chunkIndex: 0,
      totalChunks: 2,
      createdAt: new Date().toISOString(),
      fileHash: 'abc123def456',
    },
    namespace: 'meetings',
  },
  {
    id: 'doc-002',
    content: 'Technical discussion about cloud migration and infrastructure.',
    metadata: {
      source: 'meeting-2024-q1.vtt',
      type: 'transcript',
      topic: 'Technical',
      speakers: ['Bob Johnson', 'Jane Smith'],
      startTime: 20,
      endTime: 28,
      chunkIndex: 1,
      totalChunks: 2,
      createdAt: new Date().toISOString(),
      fileHash: 'abc123def456',
    },
    namespace: 'meetings',
  },
];

export const mockDocumentChunks: ChunkResult[] = [
  {
    topic: 'Introduction',
    startIdx: 0,
    endIdx: 0,
    content: '# Project Overview\n\nThis document outlines our project goals.',
    metadata: {
      startTime: 0,
      endTime: 0,
      speakers: ['document'],
    },
  },
  {
    topic: 'Requirements',
    startIdx: 1,
    endIdx: 1,
    content:
      '## Technical Requirements\n\nWe need to implement the following...',
    metadata: {
      startTime: 1,
      endTime: 1,
      speakers: ['document'],
    },
  },
];

export const mockEmptyChunks: ChunkResult[] = [];

export const mockSingleChunk: ChunkResult = {
  topic: 'General Discussion',
  startIdx: 0,
  endIdx: 4,
  content: 'A single chunk containing all content.',
  metadata: {
    startTime: 0,
    endTime: 28,
    speakers: ['Multiple Speakers'],
  },
};
