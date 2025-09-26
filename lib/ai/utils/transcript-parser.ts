import { getLogger } from '@/lib/logger';

const logger = getLogger('transcript-parser');
import type { TranscriptItem } from '../../rag/types';

export function parseTranscript(content: string): TranscriptItem[] {
  // Debug logging to understand what content we're receiving
  logger.info('[parseTranscript] Content length:', content.length);
  logger.info('[parseTranscript] First 500 chars:', content.substring(0, 500));
  logger.info(
    '[parseTranscript] Has VIEW RECORDING:',
    content.includes('VIEW RECORDING'),
  );
  logger.info(
    '[parseTranscript] Has timestamp pattern:',
    /^\d+:\d+/m.test(content),
  );

  if (content.includes('WEBVTT')) {
    return parseWebVTT(content);
  } else if (
    content.includes('VIEW RECORDING') ||
    /^\d{2}:\d{2}:\d{2}\s+\w+/m.test(content)
  ) {
    const result = parseFathom(content);
    logger.info(
      '[parseTranscript] parseFathom returned',
      result.length,
      'items',
    );
    return result;
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

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;

    // Try two patterns:
    // 1. "HH:MM:SS Speaker: Text" (simple format with text on same line)
    // 2. "M:SS - Speaker (Role)" with text on NEXT line (actual Fathom format)

    // Pattern 1: Simple format like "00:00:00 Speaker 1: Welcome"
    const simpleMatch = line.match(/^(\d{2}:\d{2}:\d{2})\s+([^:]+):\s*(.+)$/);
    if (simpleMatch) {
      const timecode = timeToSeconds(simpleMatch[1]);
      const speaker = simpleMatch[2].trim();
      const text = simpleMatch[3].trim();
      items.push({ timecode, speaker, text });
      continue;
    }

    // Pattern 2: Fathom format with dash "M:SS - Speaker (Company)"
    const fathomMatch = line.match(
      /^(\d+:\d+(?::\d+)?)\s*-\s*([^(]+)(?:\([^)]+\))?/,
    );
    if (fathomMatch) {
      const timecode = timeToSeconds(fathomMatch[1]);
      const speaker = fathomMatch[2].trim();

      // Look for text on the NEXT line(s) until we hit another timestamp or empty line
      let text = '';
      let j = i + 1;
      while (j < lines.length) {
        const nextLine = lines[j].trim();

        // Stop if we hit an empty line or another timestamp
        if (!nextLine || /^\d+:\d+/.test(nextLine)) {
          break;
        }

        // Add this line to the text
        text += (text ? ' ' : '') + nextLine;
        j++;
      }

      if (text) {
        items.push({ timecode, speaker, text });
        // Skip the lines we've already processed
        i = j - 1;
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
  // Match headers and their content
  const headerRegex = /^(#{1,3})\s+(.+)$/gm;
  const sections: TranscriptItem[] = [];
  const lastIndex = 0;
  let match: RegExpExecArray | null = null;
  let sectionIndex = 0;

  // Find all headers and their positions
  const matches: Array<{ start: number; title: string }> = [];
  match = headerRegex.exec(content);
  while (match !== null) {
    matches.push({ start: match.index, title: match[2] });
    match = headerRegex.exec(content);
  }

  // Extract sections between headers
  matches.forEach((current, i) => {
    const nextStart = matches[i + 1]?.start || content.length;
    const sectionContent = content.substring(current.start, nextStart).trim();

    // Remove the header line itself from content
    const contentWithoutHeader = sectionContent
      .replace(/^#{1,3}\s+.+$/m, '')
      .trim();

    if (contentWithoutHeader) {
      sections.push({
        timecode: sectionIndex++,
        speaker: current.title,
        text: contentWithoutHeader,
      });
    }
  });

  // If no headers found, treat the entire content as one section
  if (sections.length === 0 && content.trim()) {
    return [
      {
        timecode: 0,
        speaker: 'document',
        text: content.trim(),
      },
    ];
  }

  return sections;
}
