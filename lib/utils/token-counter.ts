/**
 * Estimates token count using Voyage AI's ~5 characters per token ratio
 * @param text - The text to count tokens for
 * @returns Estimated token count
 */
export function countTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 5);
}
