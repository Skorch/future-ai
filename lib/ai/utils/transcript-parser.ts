import type { TranscriptItem } from '../../rag/types';

export function parseTranscript(content: string): TranscriptItem[] {
  if (content.includes('WEBVTT')) {
    return parseWebVTT(content);
  } else if (
    content.includes('VIEW RECORDING') ||
    /^\d{2}:\d{2}:\d{2}\s+\w+/m.test(content)
  ) {
    return parseFathom(content);
  } else {
    throw new Error('Unsupported format. Expected WebVTT or Fathom.');
  }
}

function parseWebVTT(content: string): TranscriptItem[] {
  const items: TranscriptItem[] = [];
  const blocks = content.split('\n\n').filter((b) => b.includes('-->'));

  blocks.forEach((block) => {
    const lines = block.split('\n');
    const timeLine = lines.find((l) => l.includes('-->'));
    if (!timeLine) return;

    const startTime = timeLine.split('-->')[0].trim();
    const timecode = timeToSeconds(startTime);

    const textLine = lines[lines.length - 1];

    // Handle WebVTT voice tags like <v Speaker Name>Text
    const voiceMatch = textLine.match(/<v\s+([^>]+)>(.+)/);
    if (voiceMatch) {
      const speaker = voiceMatch[1].trim();
      const text = voiceMatch[2].trim();
      items.push({ timecode, speaker, text });
      return;
    }

    // Handle format with colon like "Speaker: Text"
    const colonIndex = textLine.indexOf(':');
    if (colonIndex !== -1) {
      const speaker = textLine.substring(0, colonIndex).trim();
      const text = textLine.substring(colonIndex + 1).trim();
      items.push({ timecode, speaker, text });
    }
  });

  return items;
}

function parseFathom(content: string): TranscriptItem[] {
  const items: TranscriptItem[] = [];
  const lines = content.split('\n');

  for (const line of lines) {
    if (!line.trim()) continue;

    // Try two patterns:
    // 1. "HH:MM:SS Speaker: Text" (simple format)
    // 2. "HH:MM:SS - Speaker (Role)" with text on next line (complex format)

    // Pattern 1: Simple format like "00:00:00 Speaker 1: Welcome"
    const simpleMatch = line.match(/^(\d{2}:\d{2}:\d{2})\s+([^:]+):\s*(.+)$/);
    if (simpleMatch) {
      const timecode = timeToSeconds(simpleMatch[1]);
      const speaker = simpleMatch[2].trim();
      const text = simpleMatch[3].trim();
      items.push({ timecode, speaker, text });
      continue;
    }

    // Pattern 2: Complex format with dash
    const complexMatch = line.match(
      /^(\d+:\d+(?::\d+)?)\s*-\s*([^(]+)(?:\([^)]+\))?/,
    );
    if (complexMatch) {
      const timecode = timeToSeconds(complexMatch[1]);
      const speaker = complexMatch[2].trim();
      // For complex format, text might be on the same line after a colon or on next line
      const colonIndex = line.indexOf(
        ':',
        line.indexOf(speaker) + speaker.length,
      );
      const text = colonIndex > -1 ? line.substring(colonIndex + 1).trim() : '';
      if (text) {
        items.push({ timecode, speaker, text });
      }
    }
  }

  return items;
}

function timeToSeconds(time: string): number {
  const parts = time.split(':').map((p) => Number.parseFloat(p));
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  } else if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  return 0;
}

// For documents
export function parseDocument(content: string): TranscriptItem[] {
  const sections = content.split(/^#{1,3}\s+/m).filter(Boolean);
  return sections.map((section, idx) => ({
    timecode: idx,
    speaker: 'document',
    text: section.trim(),
  }));
}
