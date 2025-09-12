import { z } from 'zod';

export const MeetingSummaryMetadataSchema = z.object({
  date: z.string().optional(),
  participants: z.array(z.string()).optional(),
  duration: z.string().optional(),
  meetingTitle: z.string().optional(),
});

export type MeetingSummaryMetadata = z.infer<
  typeof MeetingSummaryMetadataSchema
>;

export interface ExtractedTopic {
  title: string;
  level: number;
  content?: string;
  isTopicSection: boolean;
}

/**
 * Extract topics from a markdown summary by parsing H2 headers
 * Filters out meta sections like "Key Decisions", "Action Items", etc.
 */
export function extractTopicsFromSummary(markdown: string): string[] {
  const h2Regex = /^## (.+)$/gm;
  const topics: string[] = [];
  const metaSections = [
    'Executive Overview',
    'Key Decisions',
    'Action Items',
    'Next Meeting',
    'Next Steps',
    'Summary',
    'Overview',
    'Participants',
    'Attendees',
  ];

  let match: RegExpExecArray | null;
  match = h2Regex.exec(markdown);
  while (match !== null) {
    const header = match[1].trim();

    // Check if it's a topic section
    if (header.startsWith('Topic:')) {
      // Remove "Topic:" prefix
      topics.push(header.replace(/^Topic:\s*/i, '').trim());
    } else if (
      !metaSections.some((meta) =>
        header.toLowerCase().includes(meta.toLowerCase()),
      )
    ) {
      // Include any H2 that's not a meta section
      topics.push(header);
    }
    match = h2Regex.exec(markdown);
  }

  return topics;
}

/**
 * Extract all headers with their levels and content
 */
export function extractAllHeaders(markdown: string): ExtractedTopic[] {
  const lines = markdown.split('\n');
  const headers: ExtractedTopic[] = [];
  const headerRegex = /^(#{1,6})\s+(.+)$/;

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(headerRegex);
    if (match) {
      const level = match[1].length;
      const title = match[2].trim();
      const isTopicSection =
        level === 2 && (title.startsWith('Topic:') || !isMetaSection(title));

      // Find content until next header
      let content = '';
      for (let j = i + 1; j < lines.length; j++) {
        if (lines[j].match(headerRegex)) break;
        content += `${lines[j]}\n`;
      }

      headers.push({
        title,
        level,
        content: content.trim(),
        isTopicSection,
      });
    }
  }

  return headers;
}

/**
 * Parse meeting metadata from summary frontmatter or first section
 */
export function parseMeetingMetadata(markdown: string): MeetingSummaryMetadata {
  const metadata: MeetingSummaryMetadata = {};

  // Look for specific patterns in the content
  const dateMatch = markdown.match(/\*\*Date:\*\*\s*(.+)/);
  if (dateMatch) metadata.date = dateMatch[1].trim();

  const participantsMatch = markdown.match(/\*\*Participants?:\*\*\s*(.+)/);
  if (participantsMatch) {
    metadata.participants = participantsMatch[1]
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean);
  }

  const durationMatch = markdown.match(/\*\*Duration:\*\*\s*(.+)/);
  if (durationMatch) metadata.duration = durationMatch[1].trim();

  // Extract title from H1 if present
  const titleMatch = markdown.match(/^# (.+)$/m);
  if (titleMatch) {
    metadata.meetingTitle = titleMatch[1]
      .replace(/Meeting Summary:?\s*/i, '')
      .trim();
  }

  return metadata;
}

function isMetaSection(title: string): boolean {
  const metaKeywords = [
    'overview',
    'summary',
    'decisions',
    'action items',
    'next meeting',
    'next steps',
    'participants',
    'attendees',
    'key points',
    'takeaways',
    'follow-up',
    'notes',
  ];

  const lowerTitle = title.toLowerCase();
  return metaKeywords.some((keyword) => lowerTitle.includes(keyword));
}

/**
 * Validate that a summary has the expected structure
 */
export function validateSummaryStructure(markdown: string): {
  isValid: boolean;
  topics: string[];
  errors: string[];
} {
  const errors: string[] = [];
  const topics = extractTopicsFromSummary(markdown);

  // Check for required sections
  if (!markdown.includes('# Meeting Summary') && !markdown.match(/^# .+/m)) {
    errors.push('Missing title (H1 header)');
  }

  if (topics.length === 0) {
    errors.push('No topic sections found (use "## Topic: [Name]" format)');
  }

  if (topics.length > 0 && topics.length < 2) {
    errors.push(
      'Only one topic found - consider breaking down the discussion further',
    );
  }

  if (!markdown.match(/\*\*Date:\*\*/)) {
    errors.push('Missing meeting date');
  }

  if (!markdown.match(/\*\*Participants?:\*\*/)) {
    errors.push('Missing participants list');
  }

  return {
    isValid: errors.length === 0,
    topics,
    errors,
  };
}

/**
 * Extract metadata from HTML comments in content
 */
export function extractMetadataFromContent(content: string): {
  documentType?: string;
  metadata?: Record<string, unknown>;
  cleanContent: string;
} {
  const metadataRegex = /^<!--\s*metadata:\s*({[\s\S]*?})\s*-->/m;
  const match = content.match(metadataRegex);

  if (match) {
    try {
      const metadata = JSON.parse(match[1]);
      const cleanContent = content.replace(/^<!--[\s\S]*?-->\n*/gm, '');
      return {
        documentType: metadata.documentType,
        metadata,
        cleanContent,
      };
    } catch {
      // Invalid JSON, return content as-is
    }
  }

  return { cleanContent: content };
}

/**
 * Embed metadata as HTML comments in content
 */
export function embedMetadataInContent(
  content: string,
  documentType: string,
  metadata: Record<string, unknown>,
  topicsFound: string[],
): string {
  const metadataComment = `<!-- 
metadata: ${JSON.stringify(
    {
      documentType,
      ...metadata,
      topicsFound,
    },
    null,
    2,
  )}
-->`;

  const summaryComment = `<!-- 
Meeting Summary Document
Topics Found: ${topicsFound.join(', ')}
Generated: ${new Date().toISOString()}
-->`;

  return `${metadataComment}\n${summaryComment}\n\n${content}`;
}
