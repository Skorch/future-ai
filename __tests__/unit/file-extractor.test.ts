import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  extractFileContent,
  canExtractContent,
} from '@/lib/utils/file-content-extractor';

global.fetch = vi.fn();

describe('File Content Extractor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should extract text from plain text files', async () => {
    const mockContent = 'This is a meeting transcript';
    vi.mocked(fetch).mockResolvedValue(
      new Response(mockContent, { status: 200 }),
    );

    const result = await extractFileContent(
      'https://example.com/file.txt',
      'text/plain',
    );

    expect(result.content).toBe(mockContent);
    expect(result.metadata.format).toBe('text');
    expect(result.metadata.characterCount).toBe(mockContent.length);
    expect(result.metadata.contentType).toBe('text/plain');
  });

  it('should detect VTT format', async () => {
    const vttContent =
      'WEBVTT\n\n00:00:00.000 --> 00:00:05.000\nSpeaker: Hello';
    vi.mocked(fetch).mockResolvedValue(
      new Response(vttContent, { status: 200 }),
    );

    const result = await extractFileContent(
      'https://example.com/file.vtt',
      'text/vtt',
    );

    expect(result.content).toBe(vttContent);
    expect(result.metadata.format).toBe('vtt');
  });

  it('should detect VTT format from content even with different content type', async () => {
    const vttContent =
      'WEBVTT\n\n00:00:00.000 --> 00:00:05.000\nSpeaker: Hello';
    vi.mocked(fetch).mockResolvedValue(
      new Response(vttContent, { status: 200 }),
    );

    const result = await extractFileContent(
      'https://example.com/file.txt',
      'text/plain',
    );

    expect(result.content).toBe(vttContent);
    expect(result.metadata.format).toBe('vtt');
  });

  it('should detect markdown format', async () => {
    const mdContent = '# Meeting Notes\n\n## Topic 1\n\nDiscussion points';
    vi.mocked(fetch).mockResolvedValue(
      new Response(mdContent, { status: 200 }),
    );

    const result = await extractFileContent(
      'https://example.com/notes.md',
      'text/markdown',
    );

    expect(result.content).toBe(mdContent);
    expect(result.metadata.format).toBe('markdown');
  });

  it('should extract JSON content', async () => {
    const jsonContent = '{"meeting": "data", "participants": ["Alice", "Bob"]}';
    vi.mocked(fetch).mockResolvedValue(
      new Response(jsonContent, { status: 200 }),
    );

    const result = await extractFileContent(
      'https://example.com/data.json',
      'application/json',
    );

    expect(result.content).toBe(jsonContent);
    expect(result.metadata.format).toBe('json');
    expect(result.metadata.contentType).toBe('application/json');
  });

  it('should throw error for PDF files with helpful message', async () => {
    await expect(
      extractFileContent('https://example.com/document.pdf', 'application/pdf'),
    ).rejects.toThrow(
      'PDF extraction not yet implemented. Please convert to text format.',
    );
  });

  it('should throw error for unsupported types', async () => {
    await expect(
      extractFileContent(
        'https://example.com/file.exe',
        'application/x-msdownload',
      ),
    ).rejects.toThrow(
      'Cannot extract text from application/x-msdownload files',
    );
  });

  it('should handle fetch errors', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(null, { status: 404, statusText: 'Not Found' }),
    );

    await expect(
      extractFileContent('https://example.com/missing.txt', 'text/plain'),
    ).rejects.toThrow('Failed to fetch file: Not Found');
  });

  it('should handle server errors', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(null, { status: 500, statusText: 'Internal Server Error' }),
    );

    await expect(
      extractFileContent('https://example.com/error.txt', 'text/plain'),
    ).rejects.toThrow('Failed to fetch file: Internal Server Error');
  });

  it('should include extraction timestamp', async () => {
    const mockContent = 'Test content';
    vi.mocked(fetch).mockResolvedValue(
      new Response(mockContent, { status: 200 }),
    );

    const before = new Date().getTime();
    const result = await extractFileContent(
      'https://example.com/file.txt',
      'text/plain',
    );
    const after = new Date().getTime();

    expect(result.metadata.extractedAt).toBeDefined();
    const extractedTime = new Date(result.metadata.extractedAt).getTime();
    expect(extractedTime).toBeGreaterThanOrEqual(before);
    expect(extractedTime).toBeLessThanOrEqual(after);
  });

  describe('canExtractContent', () => {
    it('should return true for text types', () => {
      expect(canExtractContent('text/plain')).toBe(true);
      expect(canExtractContent('text/vtt')).toBe(true);
      expect(canExtractContent('text/markdown')).toBe(true);
      expect(canExtractContent('text/csv')).toBe(true);
    });

    it('should return true for JSON', () => {
      expect(canExtractContent('application/json')).toBe(true);
    });

    it('should return true for PDF', () => {
      expect(canExtractContent('application/pdf')).toBe(true);
    });

    it('should return false for images', () => {
      expect(canExtractContent('image/jpeg')).toBe(false);
      expect(canExtractContent('image/png')).toBe(false);
      expect(canExtractContent('image/gif')).toBe(false);
      expect(canExtractContent('image/webp')).toBe(false);
    });

    it('should return false for binary files', () => {
      expect(canExtractContent('application/octet-stream')).toBe(false);
      expect(canExtractContent('application/x-msdownload')).toBe(false);
      expect(canExtractContent('application/zip')).toBe(false);
    });

    it('should return false for video files', () => {
      expect(canExtractContent('video/mp4')).toBe(false);
      expect(canExtractContent('video/webm')).toBe(false);
    });

    it('should return false for audio files', () => {
      expect(canExtractContent('audio/mpeg')).toBe(false);
      expect(canExtractContent('audio/wav')).toBe(false);
    });
  });
});
