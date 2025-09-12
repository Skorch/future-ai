import { describe, it, expect } from 'vitest';
import {
  extractTopicsFromSummary,
  extractAllHeaders,
  parseMeetingMetadata,
  validateSummaryStructure,
  extractMetadataFromContent,
  embedMetadataInContent,
} from '@/lib/ai/utils/summary-parser';

describe('Summary Parser', () => {
  const sampleSummary = `# Meeting Summary: Architecture Review
**Date:** 2024-01-15
**Participants:** Alice, Bob, Charlie
**Duration:** 45 minutes

## Executive Overview
Team discussed authentication architecture and database migration strategy.

## Topic: Authentication Architecture
- Discussed JWT vs session-based auth
- Decision: Use JWT with refresh tokens
- **Action:** Bob to implement by Friday

## Topic: Database Migration Strategy
- Reviewed zero-downtime migration options
- Charlie presented blue-green approach
- **Decision:** Proceed with staged migration

## Key Decisions
1. JWT authentication with 15-minute tokens
2. Blue-green database migration

## Action Items
| Owner | Task | Due Date |
|-------|------|----------|
| Bob | Implement JWT | Jan 19 |
`;

  describe('extractTopicsFromSummary', () => {
    it('should extract topic sections with Topic: prefix', () => {
      const topics = extractTopicsFromSummary(sampleSummary);
      expect(topics).toEqual([
        'Authentication Architecture',
        'Database Migration Strategy',
      ]);
    });

    it('should ignore meta sections', () => {
      const topics = extractTopicsFromSummary(sampleSummary);
      expect(topics).not.toContain('Executive Overview');
      expect(topics).not.toContain('Key Decisions');
      expect(topics).not.toContain('Action Items');
    });

    it('should handle topics without Topic: prefix', () => {
      const summaryWithoutPrefix = `## Authentication Discussion
Some content

## Database Planning
More content

## Action Items
Tasks here`;

      const topics = extractTopicsFromSummary(summaryWithoutPrefix);
      expect(topics).toEqual([
        'Authentication Discussion',
        'Database Planning',
      ]);
    });

    it('should return empty array for no topics', () => {
      const noTopics = `# Meeting Summary
## Key Decisions
## Action Items
## Next Steps`;

      const topics = extractTopicsFromSummary(noTopics);
      expect(topics).toEqual([]);
    });

    it('should handle empty content', () => {
      const topics = extractTopicsFromSummary('');
      expect(topics).toEqual([]);
    });

    it('should handle malformed markdown', () => {
      const malformed = `This is not markdown
Just plain text
No headers at all`;

      const topics = extractTopicsFromSummary(malformed);
      expect(topics).toEqual([]);
    });
  });

  describe('parseMeetingMetadata', () => {
    it('should extract meeting metadata', () => {
      const metadata = parseMeetingMetadata(sampleSummary);
      expect(metadata).toEqual({
        date: '2024-01-15',
        participants: ['Alice', 'Bob', 'Charlie'],
        duration: '45 minutes',
        meetingTitle: 'Architecture Review',
      });
    });

    it('should handle missing metadata gracefully', () => {
      const minimal = '# Quick Sync\nSome content';
      const metadata = parseMeetingMetadata(minimal);
      expect(metadata).toEqual({
        meetingTitle: 'Quick Sync',
      });
    });

    it('should parse participants with various formats', () => {
      const withParticipants = '**Participants:** Alice, Bob, Charlie and Dave';
      const metadata = parseMeetingMetadata(withParticipants);
      expect(metadata.participants).toBeDefined();
      expect(metadata.participants?.length).toBeGreaterThan(0);
    });

    it('should handle singular Participant label', () => {
      const singular = '**Participant:** Alice';
      const metadata = parseMeetingMetadata(singular);
      expect(metadata.participants).toEqual(['Alice']);
    });

    it('should strip Meeting Summary prefix from title', () => {
      const withPrefix = '# Meeting Summary: Important Discussion';
      const metadata = parseMeetingMetadata(withPrefix);
      expect(metadata.meetingTitle).toBe('Important Discussion');
    });
  });

  describe('extractAllHeaders', () => {
    it('should extract all headers with levels', () => {
      const headers = extractAllHeaders(sampleSummary);

      const h1 = headers.find((h) => h.level === 1);
      expect(h1?.title).toBe('Meeting Summary: Architecture Review');

      const topics = headers.filter((h) => h.isTopicSection);
      expect(topics).toHaveLength(2);
      expect(topics[0].title).toBe('Topic: Authentication Architecture');
    });

    it('should include content for each header', () => {
      const headers = extractAllHeaders(sampleSummary);
      const authTopic = headers.find(
        (h) => h.title === 'Topic: Authentication Architecture',
      );

      expect(authTopic?.content).toContain('JWT vs session-based auth');
      expect(authTopic?.content).toContain('Bob to implement');
    });

    it('should correctly identify topic sections', () => {
      const headers = extractAllHeaders(sampleSummary);

      const topicHeaders = headers.filter((h) => h.isTopicSection);
      expect(topicHeaders).toHaveLength(2);

      const metaHeaders = headers.filter(
        (h) => !h.isTopicSection && h.level === 2,
      );
      expect(metaHeaders.map((h) => h.title)).toContain('Executive Overview');
    });

    it('should handle headers at various levels', () => {
      const multiLevel = `# H1 Title
## H2 Section
### H3 Subsection
#### H4 Detail
##### H5 Minor
###### H6 Tiny`;

      const headers = extractAllHeaders(multiLevel);
      expect(headers).toHaveLength(6);
      expect(headers[0].level).toBe(1);
      expect(headers[5].level).toBe(6);
    });
  });

  describe('validateSummaryStructure', () => {
    it('should validate a well-formed summary', () => {
      const result = validateSummaryStructure(sampleSummary);

      expect(result.isValid).toBe(true);
      expect(result.topics).toHaveLength(2);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect missing title', () => {
      const noTitle = sampleSummary.replace(/^# .+\n/, '');
      const result = validateSummaryStructure(noTitle);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Missing title (H1 header)');
    });

    it('should detect missing topics', () => {
      const noTopics = `# Meeting Summary
**Date:** 2024-01-15
**Participants:** Alice

## Executive Overview
Quick meeting

## Key Decisions
None`;

      const result = validateSummaryStructure(noTopics);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'No topic sections found (use "## Topic: [Name]" format)',
      );
    });

    it('should warn about too few topics', () => {
      const oneTopic = `# Meeting
**Date:** 2024-01-15
**Participants:** Alice

## Topic: Single Discussion
Content here`;

      const result = validateSummaryStructure(oneTopic);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Only one topic found - consider breaking down the discussion further',
      );
    });

    it('should detect missing date', () => {
      const noDate = sampleSummary.replace(/\*\*Date:\*\*.+\n/, '');
      const result = validateSummaryStructure(noDate);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Missing meeting date');
    });

    it('should detect missing participants', () => {
      const noParticipants = sampleSummary.replace(
        /\*\*Participants:\*\*.+\n/,
        '',
      );
      const result = validateSummaryStructure(noParticipants);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Missing participants list');
    });

    it('should return all errors at once', () => {
      const badSummary = 'Just some text with no structure';
      const result = validateSummaryStructure(badSummary);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(3);
    });
  });

  describe('extractMetadataFromContent', () => {
    it('should extract metadata from HTML comments', () => {
      const contentWithMetadata = `<!-- 
metadata: {
  "documentType": "meeting-summary",
  "meetingDate": "2024-01-15",
  "participants": ["Alice", "Bob"]
}
-->

# Meeting Content Here`;

      const result = extractMetadataFromContent(contentWithMetadata);

      expect(result.documentType).toBe('meeting-summary');
      expect(result.metadata).toEqual({
        documentType: 'meeting-summary',
        meetingDate: '2024-01-15',
        participants: ['Alice', 'Bob'],
      });
      expect(result.cleanContent).toBe('# Meeting Content Here');
    });

    it('should handle content without metadata', () => {
      const plainContent = '# Just a regular document';
      const result = extractMetadataFromContent(plainContent);

      expect(result.documentType).toBeUndefined();
      expect(result.metadata).toBeUndefined();
      expect(result.cleanContent).toBe(plainContent);
    });

    it('should handle invalid JSON in metadata', () => {
      const badMetadata = `<!-- 
metadata: { invalid json }
-->
Content`;

      const result = extractMetadataFromContent(badMetadata);

      expect(result.documentType).toBeUndefined();
      expect(result.metadata).toBeUndefined();
      expect(result.cleanContent).toBe(badMetadata);
    });

    it('should remove multiple HTML comments', () => {
      const multiComments = `<!-- metadata: {"test": true} -->
<!-- Another comment -->

# Title`;

      const result = extractMetadataFromContent(multiComments);
      expect(result.cleanContent).toBe('# Title');
    });
  });

  describe('embedMetadataInContent', () => {
    it('should embed metadata as HTML comments', () => {
      const content = '# Meeting Summary';
      const result = embedMetadataInContent(
        content,
        'meeting-summary',
        { meetingDate: '2024-01-15' },
        ['Topic 1', 'Topic 2'],
      );

      expect(result).toContain('<!-- \nmetadata:');
      expect(result).toContain('"documentType": "meeting-summary"');
      expect(result).toContain('"meetingDate": "2024-01-15"');
      expect(result).toContain(
        '"topicsFound": [\n    "Topic 1",\n    "Topic 2"\n  ]',
      );
      expect(result).toContain('Topics Found: Topic 1, Topic 2');
      expect(result).toContain('# Meeting Summary');
    });

    it('should include generation timestamp', () => {
      const content = 'Test';
      const result = embedMetadataInContent(content, 'test', {}, []);

      expect(result).toMatch(/Generated: \d{4}-\d{2}-\d{2}T/);
    });

    it('should handle empty topics array', () => {
      const content = 'Test';
      const result = embedMetadataInContent(content, 'test', {}, []);

      expect(result).toContain('Topics Found: ');
      expect(result).toContain('"topicsFound": []');
    });

    it('should preserve original content after metadata', () => {
      const originalContent = `# Title
## Section
Content here`;

      const result = embedMetadataInContent(originalContent, 'doc', {}, []);

      expect(result.endsWith(originalContent)).toBe(true);
    });
  });
});
