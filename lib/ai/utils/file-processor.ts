import type { ChatMessage } from '@/lib/types';

// Match the schema from app/(chat)/api/chat/schema.ts
interface FilePart {
  type: 'file';
  mediaType: string;
  name: string; // Schema uses 'name', not 'filename'
  url: string;
}

interface TextPart {
  type: 'text';
  text: string;
}

type MessagePart = FilePart | TextPart;

/**
 * Process file attachments in messages to preserve file metadata for lazy loading
 * Phase 2: Don't fetch content, just add references for the LLM to understand
 */
export async function processMessageFiles(
  messages: ChatMessage[],
): Promise<ChatMessage[]> {
  console.log('[FileProcessor] Processing messages', {
    messageCount: messages.length,
    hasFileParts: messages.some((m) => m.parts?.some((p) => p.type === 'file')),
  });

  return messages.map((message) => {
    // Skip tool messages and assistant messages - only process user messages
    if (message.role !== 'user') {
      return message;
    }

    if (!message.parts || message.parts.length === 0) {
      // Ensure user messages always have at least an empty text part
      return {
        ...message,
        parts: [{ type: 'text', text: '' }],
      };
    }

    // Type-safe filtering of parts
    const fileParts = message.parts.filter(
      (p): p is FilePart => p.type === 'file',
    );
    const textParts = message.parts.filter(
      (p): p is TextPart => p.type === 'text',
    );

    // If there are file parts, embed URL info as structured text markers
    if (fileParts.length > 0) {
      console.log(
        `[FileProcessor] Converting ${fileParts.length} file(s) to structured text markers`,
      );

      // Create structured text markers for file information (Option 1)
      const fileInfo = fileParts
        .map((f) => {
          return [
            `FILE_URL: ${f.url}`,
            `FILENAME: ${f.name}`,
            `TYPE: ${f.mediaType}`,
          ].join('\n');
        })
        .join('\n---\n');

      // Combine user text with file information
      const userText = textParts
        .map((p) => p.text)
        .filter((t) => t.trim())
        .join(' ');
      const enhancedText = userText ? `${userText}\n\n${fileInfo}` : fileInfo;

      console.log(
        '[FileProcessor] Created structured text markers:',
        enhancedText.substring(0, 200),
      );

      // Return message with ONLY text parts (no file parts to avoid model errors)
      return {
        ...message,
        parts: [
          { type: 'text' as const, text: enhancedText },
          // NO file parts - avoiding 'File URL data' functionality not supported error
        ],
      };
    }

    // No files, return message as-is
    return message;
  });
}

// Helper functions for type-safe file handling
export function hasFileAttachments(message: ChatMessage): boolean {
  return message.parts?.some((p) => p.type === 'file') || false;
}

export function getFileParts(message: ChatMessage): FilePart[] {
  if (!message.parts) return [];
  return message.parts.filter((p): p is FilePart => p.type === 'file');
}
