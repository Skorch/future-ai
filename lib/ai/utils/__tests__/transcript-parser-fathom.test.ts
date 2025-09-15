import { describe, it, expect } from 'vitest';
import { parseTranscript } from '../transcript-parser';

describe('Fathom Transcript Parser', () => {
  it('should detect and parse Fathom format with single word speakers', () => {
    const content = `00:00:00 Neil: Welcome everyone
00:00:15 Andrew: Thanks for having me`;

    const items = parseTranscript(content);

    expect(items).toHaveLength(2);
    expect(items[0].speaker).toBe('Neil');
    expect(items[0].text).toBe('Welcome everyone');
  });

  it('should detect and parse Fathom format with multi-word speakers', () => {
    const content = `00:00:00 Neil Beaupre: Welcome everyone
00:00:15 Andrew Smith: Thanks for having me`;

    // This might fail if the regex doesn't handle multi-word speakers
    const items = parseTranscript(content);

    expect(items).toHaveLength(2);
    expect(items[0].speaker).toBe('Neil Beaupre');
    expect(items[0].text).toBe('Welcome everyone');
  });

  it('should detect format with "Speaker N" pattern', () => {
    const content = `00:00:00 Speaker 1: Welcome everyone
00:00:15 Speaker 2: Thanks for having me`;

    const items = parseTranscript(content);

    expect(items).toHaveLength(2);
    expect(items[0].speaker).toBe('Speaker 1');
  });

  it('should throw error for unsupported format', () => {
    const content = `Just plain text without any timestamps`;

    expect(() => parseTranscript(content)).toThrow('Unsupported format');
  });

  it('should detect VIEW RECORDING header', () => {
    const content = `VIEW RECORDING

00:00:00 Neil: Welcome everyone`;

    const items = parseTranscript(content);
    expect(items).toHaveLength(1);
  });
});
