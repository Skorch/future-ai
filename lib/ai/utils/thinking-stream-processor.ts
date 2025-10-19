/**
 * Stream processor for handling thinking tags in AI responses
 * Automatically detects and filters thinking content while streaming
 *
 * When Anthropic models use extended thinking (via thinking budget),
 * they wrap reasoning in <thinking>...</thinking> tags. This processor
 * detects those tags in the stream and routes them separately from
 * regular content, ensuring final document content doesn't include thinking.
 */

import type { UIMessageStreamWriter } from 'ai';
import type { ChatMessage } from '@/lib/types';

export class ThinkingStreamProcessor {
  private accumulatedText = '';
  private inThinkingBlock = false;
  private thinkingBuffer = '';
  private contentBuffer = '';

  /**
   * Process a text delta from the stream
   * Automatically detects thinking blocks and routes to appropriate stream events
   *
   * @param text - Text delta from the AI stream
   * @param dataStream - Stream writer to send events to UI
   */
  processTextDelta(
    text: string,
    dataStream: UIMessageStreamWriter<ChatMessage>,
  ): void {
    this.accumulatedText += text;

    // Process character by character to handle tag boundaries across chunks
    for (const char of text) {
      if (this.inThinkingBlock) {
        this.thinkingBuffer += char;

        // Check if we're closing the thinking block
        if (this.thinkingBuffer.endsWith('</thinking>')) {
          this.inThinkingBlock = false;
          // Stream the complete thinking block as reasoning
          dataStream.write({
            type: 'data-reasoning',
            data: this.thinkingBuffer,
            transient: true,
          });
          this.thinkingBuffer = '';
        }
      } else {
        this.contentBuffer += char;

        // Check if we're starting a thinking block
        if (this.contentBuffer.endsWith('<thinking>')) {
          this.inThinkingBlock = true;
          // Remove <thinking> tag from content buffer
          this.contentBuffer = this.contentBuffer.slice(0, -10);
          // Stream any accumulated content before thinking
          if (this.contentBuffer) {
            dataStream.write({
              type: 'data-textDelta',
              data: this.contentBuffer,
              transient: true,
            });
            this.contentBuffer = '';
          }
          this.thinkingBuffer = '<thinking>';
        } else if (!this.contentBuffer.includes('<thinking')) {
          // Stream regular content in chunks for better UX
          if (this.contentBuffer.length >= 20) {
            dataStream.write({
              type: 'data-textDelta',
              data: this.contentBuffer,
              transient: true,
            });
            this.contentBuffer = '';
          }
        }
      }
    }

    // Flush remaining content buffer if not potentially starting a tag
    if (
      !this.inThinkingBlock &&
      this.contentBuffer &&
      !this.contentBuffer.includes('<think')
    ) {
      dataStream.write({
        type: 'data-textDelta',
        data: this.contentBuffer,
        transient: true,
      });
      this.contentBuffer = '';
    }
  }

  /**
   * Get the final content with thinking tags removed
   * Call this after processing all deltas
   *
   * @returns Clean content without thinking tags
   */
  getFinalContent(): string {
    // Flush any remaining content buffer
    let finalText = this.accumulatedText;

    // If we have remaining content buffer, append it
    if (this.contentBuffer && !this.inThinkingBlock) {
      finalText += this.contentBuffer;
    }

    // Remove all thinking blocks from final content
    return finalText.replace(/<thinking>[\s\S]*?<\/thinking>/g, '').trim();
  }

  /**
   * Extract thinking content from the accumulated text
   * Returns null if no thinking tags found
   *
   * @returns Thinking content or null
   */
  getThinkingContent(): string | null {
    const matches = this.accumulatedText.match(
      /<thinking>([\s\S]*?)<\/thinking>/g,
    );
    if (!matches) return null;

    return matches
      .map((match) => match.replace(/<\/?thinking>/g, ''))
      .join('\n')
      .trim();
  }
}

/**
 * Simple utility to strip thinking tags from completed text
 * Use this for one-shot filtering of complete responses
 *
 * @param text - Text potentially containing thinking tags
 * @returns Text with thinking tags removed
 */
export function stripThinkingTags(text: string): string {
  return text.replace(/<thinking>[\s\S]*?<\/thinking>/g, '').trim();
}

/**
 * Check if text contains thinking tags
 *
 * @param text - Text to check
 * @returns True if thinking tags are present
 */
export function hasThinkingTags(text: string): boolean {
  return /<thinking>[\s\S]*?<\/thinking>/.test(text);
}
