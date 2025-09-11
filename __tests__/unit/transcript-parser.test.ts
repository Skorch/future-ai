import { describe, it, expect } from 'vitest';
import {
  parseTranscript,
  parseDocument,
} from '../../lib/ai/utils/transcript-parser';
import * as fixtures from '../fixtures/transcript-samples';

describe('Transcript Parser', () => {
  describe('parseTranscript() - Format Detection and Routing', () => {
    it('should detect and parse WebVTT format', () => {
      const items = parseTranscript(fixtures.validWebVTT);
      expect(items).toHaveLength(3);
      expect(items[0].speaker).toBe('Drew Beaupre');
      expect(items[0].text).toBe('Welcome to the meeting.');
    });

    it('should detect and parse Fathom format', () => {
      const items = parseTranscript(fixtures.validFathom);
      expect(items).toHaveLength(3);
      expect(items[0].speaker).toBe('Drew Beaupre');
      expect(items[0].text).toBe('Welcome to the meeting.');
    });

    it('should throw error for unsupported format', () => {
      expect(() =>
        parseTranscript('Random text without format markers'),
      ).toThrow('Unsupported format');
    });

    it('should be case-sensitive for format markers', () => {
      expect(() => parseTranscript(fixtures.webVTTLowercase)).toThrow(
        'Unsupported format',
      );
    });

    it('should handle empty string', () => {
      expect(() => parseTranscript(fixtures.emptyContent)).toThrow(
        'Unsupported format',
      );
    });

    it('should detect format even with mixed markers', () => {
      const items = parseTranscript(fixtures.mixedFormatContent);
      expect(items).toBeDefined(); // Should parse as WebVTT (first match)
    });
  });

  describe('WebVTT Parsing', () => {
    it('should parse valid WebVTT transcript', () => {
      const items = parseTranscript(fixtures.validWebVTT);

      expect(items).toHaveLength(3);
      expect(items[0]).toEqual({
        timecode: 3.84,
        speaker: 'Drew Beaupre',
        text: 'Welcome to the meeting.',
      });
      expect(items[1]).toEqual({
        timecode: 8.5,
        speaker: 'Sarah Chen',
        text: 'Thanks for having me.',
      });
      expect(items[2]).toEqual({
        timecode: 15.5,
        speaker: 'Drew Beaupre',
        text: "Let's discuss the implementation.",
      });
    });

    it('should handle timestamps with hours', () => {
      const items = parseTranscript(fixtures.webVTTWithHours);

      expect(items).toHaveLength(2);
      expect(items[0].timecode).toBe(5445.5); // 1*3600 + 30*60 + 45.5
      expect(items[0].speaker).toBe('John Doe');
      expect(items[1].timecode).toBe(8130.25); // 2*3600 + 15*60 + 30.25
    });

    it('should skip malformed blocks', () => {
      const items = parseTranscript(fixtures.malformedWebVTT);

      // Should only parse the valid entry at the end
      expect(items).toHaveLength(1);
      expect(items[0].speaker).toBe('Drew Beaupre');
      expect(items[0].text).toBe('Valid entry after malformed ones.');
    });

    it('should handle blocks without proper speaker format', () => {
      const items = parseTranscript(fixtures.webVTTNoSpeaker);

      // Without colon, the entire line becomes text with no speaker extracted
      expect(items).toHaveLength(0); // Lines without colons are skipped
    });

    it('should handle empty blocks', () => {
      const items = parseTranscript(fixtures.webVTTWithEmptyBlocks);

      // Parser processes all blocks with timestamps, even if text is empty
      expect(items.length).toBeGreaterThan(0);
      // Find the valid entry
      const validEntry = items.find(
        (item) => item.text === 'Text after empty block',
      );
      expect(validEntry).toBeDefined();
      expect(validEntry?.speaker).toBe('Speaker');
    });

    it('should handle multiple colons in text', () => {
      const items = parseTranscript(fixtures.webVTTWithMultipleColons);

      expect(items).toHaveLength(1);
      expect(items[0].speaker).toBe('Speaker');
      expect(items[0].text).toBe('URL: https://example.com - more text');
    });

    it('should handle Unicode content', () => {
      const items = parseTranscript(fixtures.unicodeContent);

      expect(items).toHaveLength(1);
      expect(items[0].text).toBe('你好世界 🌍 Unicode test');
    });

    it('should handle very long speaker names', () => {
      const items = parseTranscript(fixtures.veryLongSpeakerName);

      expect(items).toHaveLength(1);
      expect(items[0].speaker).toHaveLength(200);
      expect(items[0].text).toBe('Text with very long speaker name');
    });

    it('should handle special characters in speaker names', () => {
      const items = parseTranscript(fixtures.webVTTWithSpecialChars);

      expect(items).toHaveLength(2);
      expect(items[0].speaker).toBe('John@Doe.com');
      expect(items[1].speaker).toBe('Speaker [Admin]');
    });

    it('should handle large transcripts efficiently', () => {
      const startTime = Date.now();
      const items = parseTranscript(fixtures.largeTranscript);
      const duration = Date.now() - startTime;

      expect(items).toHaveLength(1000);
      expect(duration).toBeLessThan(1000); // Should parse in under 1 second
      expect(items[0].speaker).toBe('Speaker 0');
      expect(items[999].speaker).toBe('Speaker 0'); // 999 % 3 = 0
    });
  });

  describe('Fathom Parsing', () => {
    it('should parse valid Fathom transcript', () => {
      const items = parseTranscript(fixtures.validFathom);

      expect(items).toHaveLength(3);
      expect(items[0]).toEqual({
        timecode: 0,
        speaker: 'Drew Beaupre',
        text: 'Welcome to the meeting.',
      });
      expect(items[1]).toEqual({
        timecode: 15,
        speaker: 'Sarah Chen',
        text: 'Thanks for having me.',
      });
      expect(items[2]).toEqual({
        timecode: 30,
        speaker: 'Drew Beaupre',
        text: "Let's discuss the implementation.",
      });
    });

    it('should strip company names in parentheses', () => {
      const items = parseTranscript(fixtures.fathomWithCompanyNames);

      expect(items).toHaveLength(3);
      expect(items[0].speaker).toBe('Drew Beaupre');
      expect(items[1].speaker).toBe('Sarah Chen');
      expect(items[2].speaker).toBe('Mike Johnson');
    });

    it('should handle multi-line text (first line only)', () => {
      const items = parseTranscript(fixtures.fathomWithMultiLine);

      expect(items).toHaveLength(2);
      expect(items[0].text).toBe('Line 1 of text');
      // Parser takes first non-empty line after timestamp
    });

    it('should skip entries without following text', () => {
      const items = parseTranscript(fixtures.fathomNoText);

      expect(items).toHaveLength(2); // Should skip middle entry without text
      expect(items[0].speaker).toBe('Speaker One');
      expect(items[1].speaker).toBe('Speaker Three');
    });

    it('should handle timestamps with hours', () => {
      const items = parseTranscript(fixtures.fathomHoursFormat);

      expect(items).toHaveLength(2);
      expect(items[0].timecode).toBe(5445); // 1:30:45 = 1*3600 + 30*60 + 45
      expect(items[1].timecode).toBe(7200); // 2:00:00 = 2*3600
    });

    it('should require VIEW RECORDING marker', () => {
      // Without VIEW RECORDING, it won't be detected as Fathom format
      // It will throw an unsupported format error since it lacks both WEBVTT and VIEW RECORDING
      const result = () => parseTranscript(fixtures.fathomNoViewRecording);
      expect(result).toThrow('Unsupported format');
    });
  });

  describe('Document Parsing', () => {
    it('should parse markdown headers', () => {
      const items = parseDocument(fixtures.edgeCaseDocument);

      expect(items.length).toBeGreaterThan(0);
      expect(items[0].speaker).toBe('document');
      expect(items[0].timecode).toBe(0);
    });

    it('should handle documents without headers', () => {
      const items = parseDocument(fixtures.plainTextDocument);

      expect(items).toHaveLength(1);
      expect(items[0].text).toContain('plain text without any headers');
      expect(items[0].speaker).toBe('document');
    });

    it('should assign incremental timecodes', () => {
      const items = parseDocument(fixtures.edgeCaseDocument);

      expect(items[0].timecode).toBe(0);
      if (items.length > 1) {
        expect(items[1].timecode).toBe(1);
        expect(items[2].timecode).toBe(2);
      }
    });

    it('should handle documents with code blocks', () => {
      const items = parseDocument(fixtures.documentWithCodeBlocks);

      expect(items.length).toBeGreaterThan(0);
      // Code blocks should be included in the section content
      const hasCodeBlock = items.some((item) =>
        item.text.includes('code block'),
      );
      expect(hasCodeBlock).toBe(true);
    });

    it('should handle empty document', () => {
      const items = parseDocument('');

      // Empty document splits into empty array after filtering
      expect(items).toHaveLength(0);
    });
  });

  describe('Time Conversion', () => {
    it('should convert MM:SS format', () => {
      // Test via actual parsing since timeToSeconds is not exported
      const webvtt = `WEBVTT
      
1
00:01:30.000 --> 00:01:35.000
Speaker: Test MM:SS`;

      const items = parseTranscript(webvtt);
      expect(items[0].timecode).toBe(90); // 1:30 = 90 seconds
    });

    it('should convert HH:MM:SS format', () => {
      const items = parseTranscript(fixtures.webVTTWithHours);
      expect(items[0].timecode).toBe(5445.5); // 01:30:45.500
    });

    it('should handle decimal seconds', () => {
      const webvtt = `WEBVTT
      
1
00:00:05.750 --> 00:00:10.000
Speaker: Test decimals`;

      const items = parseTranscript(webvtt);
      expect(items[0].timecode).toBe(5.75);
    });

    it('should handle zero time', () => {
      const webvtt = `WEBVTT
      
1
00:00:00.000 --> 00:00:05.000
Speaker: Zero start time`;

      const items = parseTranscript(webvtt);
      expect(items[0].timecode).toBe(0);
    });

    it('should handle malformed time (returns NaN for invalid parts)', () => {
      // Invalid time formats may result in NaN timecode
      const webvtt = `WEBVTT
      
1
invalid:time --> 00:00:05.000
Speaker: Invalid start time`;

      const items = parseTranscript(webvtt);
      // Parser still processes the block, but timecode will be NaN
      if (items.length > 0) {
        expect(Number.isNaN(items[0].timecode)).toBe(true);
      }
    });
  });

  describe('Error Handling', () => {
    it('should throw descriptive error for null input', () => {
      expect(() => parseTranscript(null as any)).toThrow();
    });

    it('should throw descriptive error for undefined input', () => {
      expect(() => parseTranscript(undefined as any)).toThrow();
    });

    it('should throw error for non-string input', () => {
      expect(() => parseTranscript(123 as any)).toThrow();
      expect(() => parseTranscript({} as any)).toThrow();
      expect(() => parseTranscript([] as any)).toThrow();
    });

    it('should handle binary data by throwing unsupported format error', () => {
      const binaryString = String.fromCharCode(0, 1, 2, 3, 4);
      expect(() => parseTranscript(binaryString)).toThrow('Unsupported format');
    });
  });

  describe('Edge Cases', () => {
    it('should handle transcript with only headers', () => {
      const webvtt = `WEBVTT

`;
      const items = parseTranscript(webvtt);
      expect(items).toHaveLength(0);
    });

    it('should handle Fathom with only header', () => {
      const fathom = `Team Meeting
VIEW RECORDING

`;
      const items = parseTranscript(fathom);
      expect(items).toHaveLength(0);
    });

    it('should handle WebVTT with single entry', () => {
      const webvtt = `WEBVTT

1
00:00:05.000 --> 00:00:10.000
Speaker: Single entry`;

      const items = parseTranscript(webvtt);
      expect(items).toHaveLength(1);
    });

    it('should handle whitespace-only content after format marker', () => {
      const webvtt = `WEBVTT
      
      
      `;
      const items = parseTranscript(webvtt);
      expect(items).toHaveLength(0);
    });

    it('should handle lines with only whitespace in WebVTT blocks', () => {
      const webvtt = `WEBVTT

1
00:00:05.000 --> 00:00:10.000
   
   
2
00:00:15.000 --> 00:00:20.000
Speaker: After whitespace lines`;

      const items = parseTranscript(webvtt);
      expect(items).toHaveLength(1); // First block is invalid
    });

    it('should handle extremely long text content', () => {
      const longText = 'A'.repeat(10000);
      const webvtt = `WEBVTT

1
00:00:05.000 --> 00:00:10.000
Speaker: ${longText}`;

      const items = parseTranscript(webvtt);
      expect(items).toHaveLength(1);
      expect(items[0].text).toHaveLength(10000);
    });

    it('should handle transcript with duplicate timestamps', () => {
      const webvtt = `WEBVTT

1
00:00:05.000 --> 00:00:10.000
Speaker1: First at 5 seconds

2
00:00:05.000 --> 00:00:10.000
Speaker2: Also at 5 seconds`;

      const items = parseTranscript(webvtt);
      expect(items).toHaveLength(2);
      expect(items[0].timecode).toBe(items[1].timecode);
    });
  });
});
