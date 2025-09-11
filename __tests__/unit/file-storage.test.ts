import { describe, it, expect, vi } from 'vitest';
import {
  generateStoragePath,
  parseStoragePath,
} from '@/lib/utils/file-storage';

// Mock generateUUID to have predictable output for tests
vi.mock('@/lib/utils', () => ({
  generateUUID: () => 'test-uuid-123',
}));

describe('File Storage Utilities', () => {
  describe('generateStoragePath', () => {
    it('should generate path with user_id/chat_id/file_id.ext structure', () => {
      const path = generateStoragePath({
        userId: 'user123',
        chatId: 'chat456',
        filename: 'meeting.txt',
      });

      expect(path).toBe('user123/chat456/test-uuid-123.txt');
    });

    it('should handle files with multiple dots', () => {
      const path = generateStoragePath({
        userId: 'user123',
        chatId: 'chat456',
        filename: 'meeting.notes.final.txt',
      });

      expect(path).toBe('user123/chat456/test-uuid-123.txt');
    });

    it('should handle files without extension', () => {
      const path = generateStoragePath({
        userId: 'user123',
        chatId: 'chat456',
        filename: 'README',
      });

      expect(path).toBe('user123/chat456/test-uuid-123.bin');
    });

    it('should handle VTT files', () => {
      const path = generateStoragePath({
        userId: 'user123',
        chatId: 'chat456',
        filename: 'transcript.vtt',
      });

      expect(path).toBe('user123/chat456/test-uuid-123.vtt');
    });

    it('should handle markdown files', () => {
      const path = generateStoragePath({
        userId: 'user123',
        chatId: 'chat456',
        filename: 'notes.md',
      });

      expect(path).toBe('user123/chat456/test-uuid-123.md');
    });

    it('should handle PDF files', () => {
      const path = generateStoragePath({
        userId: 'user123',
        chatId: 'chat456',
        filename: 'document.pdf',
      });

      expect(path).toBe('user123/chat456/test-uuid-123.pdf');
    });

    it('should handle JSON files', () => {
      const path = generateStoragePath({
        userId: 'user123',
        chatId: 'chat456',
        filename: 'data.json',
      });

      expect(path).toBe('user123/chat456/test-uuid-123.json');
    });
  });

  describe('parseStoragePath', () => {
    it('should parse valid storage path', () => {
      const result = parseStoragePath('user123/chat456/file789.txt');

      expect(result).toEqual({
        userId: 'user123',
        chatId: 'chat456',
        fileId: 'file789',
      });
    });

    it('should parse path with UUID file id', () => {
      const result = parseStoragePath(
        'user123/chat456/550e8400-e29b-41d4-a716-446655440000.txt',
      );

      expect(result).toEqual({
        userId: 'user123',
        chatId: 'chat456',
        fileId: '550e8400-e29b-41d4-a716-446655440000',
      });
    });

    it('should return null for invalid path with too few segments', () => {
      const result = parseStoragePath('user123/file.txt');

      expect(result).toBeNull();
    });

    it('should return null for invalid path with too many segments', () => {
      const result = parseStoragePath('extra/user123/chat456/file.txt');

      expect(result).toBeNull();
    });

    it('should return null for empty path', () => {
      const result = parseStoragePath('');

      expect(result).toBeNull();
    });

    it('should handle paths with different extensions', () => {
      const vttResult = parseStoragePath('user123/chat456/file789.vtt');
      expect(vttResult).toEqual({
        userId: 'user123',
        chatId: 'chat456',
        fileId: 'file789',
      });

      const pdfResult = parseStoragePath('user123/chat456/file789.pdf');
      expect(pdfResult).toEqual({
        userId: 'user123',
        chatId: 'chat456',
        fileId: 'file789',
      });
    });
  });
});
