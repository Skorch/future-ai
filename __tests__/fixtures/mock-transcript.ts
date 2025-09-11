import type { TranscriptItem } from '../../lib/rag/types';

export const mockTranscriptItems: TranscriptItem[] = [
  {
    timecode: 0,
    speaker: 'John Doe',
    text: 'Welcome everyone to our quarterly planning meeting.',
  },
  {
    timecode: 5,
    speaker: 'Jane Smith',
    text: "Thank you, John. Let's start with the budget review.",
  },
  {
    timecode: 12,
    speaker: 'John Doe',
    text: 'Our Q1 budget shows a 15% increase in operational costs.',
  },
  {
    timecode: 20,
    speaker: 'Bob Johnson',
    text: 'We need to discuss the technical infrastructure upgrades.',
  },
  {
    timecode: 28,
    speaker: 'Jane Smith',
    text: 'The cloud migration is our top priority this quarter.',
  },
];

export const mockLongTranscript: TranscriptItem[] = Array.from(
  { length: 100 },
  (_, i) => ({
    timecode: i * 10,
    speaker: ['Alice', 'Bob', 'Charlie'][i % 3],
    text: `Discussion point ${i + 1} about ${
      ['planning', 'budget', 'technical'][i % 3]
    } topics.`,
  }),
);

export const mockEmptyTranscript: TranscriptItem[] = [];

export const mockSingleSpeakerTranscript: TranscriptItem[] = [
  {
    timecode: 0,
    speaker: 'Presenter',
    text: 'This is a monologue presentation.',
  },
  {
    timecode: 10,
    speaker: 'Presenter',
    text: 'Continuing with the main points.',
  },
  {
    timecode: 20,
    speaker: 'Presenter',
    text: 'Final thoughts and conclusions.',
  },
];

export const mockUnicodeTranscript: TranscriptItem[] = [
  {
    timecode: 0,
    speaker: '张伟',
    text: '欢迎大家参加今天的会议。',
  },
  {
    timecode: 5,
    speaker: 'María García',
    text: '¡Hola! Gracias por la invitación.',
  },
  {
    timecode: 10,
    speaker: 'François Dubois',
    text: 'Bonjour, commençons la réunion.',
  },
  {
    timecode: 15,
    speaker: '山田太郎',
    text: 'こんにちは、よろしくお願いします。',
  },
];
