import type { ChatMessage } from '@/lib/types';

interface FilePart {
  type: 'file';
  mediaType: string;
  url: string;
  name: string;
}

interface TextPart {
  type: 'text';
  text: string;
}

type MessagePart = FilePart | TextPart;

/**
 * Process file attachments in messages to extract text content for non-image files
 * This prevents "File URL data functionality not supported" errors
 */
export async function processMessageFiles(
  messages: ChatMessage[],
): Promise<ChatMessage[]> {
  return Promise.all(
    messages.map(async (message) => {
      if (!message.parts || message.parts.length === 0) {
        return message;
      }

      const processedParts = await Promise.all(
        message.parts.map(async (part): Promise<MessagePart> => {
          // Type guard for file parts
          if (part.type === 'file') {
            const filePart = part as FilePart;

            // Only process text-based media types
            if (
              filePart.mediaType === 'text/plain' ||
              filePart.mediaType === 'text/vtt' ||
              filePart.mediaType === 'application/pdf'
            ) {
              try {
                // Fetch the file content
                const response = await fetch(filePart.url);
                const content = await response.text();

                // Convert to text part with file information
                return {
                  type: 'text' as const,
                  text: `File: ${filePart.name}\n\nContent:\n${content}`,
                };
              } catch (error) {
                console.error(`Failed to fetch file ${filePart.name}:`, error);
                // Fallback to text description if fetch fails
                return {
                  type: 'text' as const,
                  text: `[Unable to load file: ${filePart.name}]`,
                };
              }
            }
          }

          // Keep image files and text parts as-is
          return part as MessagePart;
        }),
      );

      return {
        ...message,
        parts: processedParts as typeof message.parts, // Cast to the original parts type
      };
    }),
  );
}
