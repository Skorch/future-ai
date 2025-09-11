export interface TranscriptItem {
  timecode: number; // seconds from start
  speaker: string;
  text: string;
}

export function parseTranscript(content: string): TranscriptItem[] {
  if (content.includes('WEBVTT')) {
    return parseWebVTT(content);
  } else if (content.includes('VIEW RECORDING')) {
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
    const colonIndex = textLine.indexOf(':');
    if (colonIndex === -1) return;

    const speaker = textLine.substring(0, colonIndex).trim();
    const text = textLine.substring(colonIndex + 1).trim();

    items.push({ timecode, speaker, text });
  });

  return items;
}

function parseFathom(content: string): TranscriptItem[] {
  const items: TranscriptItem[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const timeMatch = line.match(
      /^(\d+:\d+(?::\d+)?)\s*-\s*([^(]+)(?:\([^)]+\))?/,
    );

    if (timeMatch) {
      const timecode = timeToSeconds(timeMatch[1]);
      const speaker = timeMatch[2].trim();

      // Next non-empty line is the text
      let j = i + 1;
      while (j < lines.length && lines[j].trim() === '') j++;

      if (j < lines.length && !lines[j].match(/^\d+:\d+/)) {
        const text = lines[j].trim();
        items.push({ timecode, speaker, text });
        i = j; // Skip processed lines
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
