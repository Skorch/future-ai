import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setMode } from '@/lib/ai/tools/set-mode';
import { updateChatMode } from '@/lib/db/queries';

// Mock the database function
vi.mock('@/lib/db/queries', () => ({
  updateChatMode: vi.fn(),
}));

describe('setMode tool', () => {
  let mockDataStream: any;
  let tool: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock successful DB update
    (updateChatMode as any).mockResolvedValue({
      id: 'test-chat',
      mode: 'build',
    });

    // Mock data stream
    mockDataStream = {
      write: vi.fn(),
    };

    // Create tool instance
    const setModeFactory = setMode({
      chatId: 'test-chat',
      dataStream: mockDataStream,
    });

    // Extract the execute function
    tool = setModeFactory;
  });

  describe('mode switching', () => {
    it('should switch modes without continuation', async () => {
      const result = await tool.execute({
        mode: 'build',
        reason: 'Ready to implement',
      });

      // DB update should be called
      expect(updateChatMode).toHaveBeenCalledWith({
        id: 'test-chat',
        mode: 'build',
      });

      // Should emit mode change event
      expect(mockDataStream.write).toHaveBeenCalledWith({
        type: 'data-modeChanged',
        data: expect.objectContaining({
          mode: 'build',
          reason: 'Ready to implement',
        }),
        transient: true,
      });

      // Should NOT emit continuation
      expect(mockDataStream.write).toHaveBeenCalledTimes(1);

      // Result should not have continuation
      expect(result.continuation).toBeNull();
    });

    it('should emit continuation when nextMessage provided', async () => {
      const result = await tool.execute({
        mode: 'build',
        reason: 'Ready to implement',
        nextMessage: 'Now implementing the auth system...',
      });

      // Should emit both events
      expect(mockDataStream.write).toHaveBeenCalledTimes(2);

      // First: mode change
      expect(mockDataStream.write).toHaveBeenNthCalledWith(1, {
        type: 'data-modeChanged',
        data: expect.objectContaining({ mode: 'build' }),
        transient: true,
      });

      // Second: continuation request
      expect(mockDataStream.write).toHaveBeenNthCalledWith(2, {
        type: 'data-continuationRequest',
        data: { message: 'Now implementing the auth system...' },
        transient: false, // Must persist for handler
      });

      // Result should include continuation
      expect(result.continuation).toBe('Now implementing the auth system...');
    });

    it('should await DB update before emitting events', async () => {
      let dbCallComplete = false;
      let eventsEmitted = false;

      // Mock slow DB update
      (updateChatMode as any).mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        dbCallComplete = true;
        return { id: 'test-chat', mode: 'build' };
      });

      // Track when events are emitted
      mockDataStream.write.mockImplementation(() => {
        eventsEmitted = true;
        // DB should be complete before any events
        expect(dbCallComplete).toBe(true);
      });

      await tool.execute({
        mode: 'build',
        reason: 'Test',
        nextMessage: 'Continue...',
      });

      expect(dbCallComplete).toBe(true);
      expect(eventsEmitted).toBe(true);
    });

    it('should handle discovery mode switch', async () => {
      const result = await tool.execute({
        mode: 'discovery',
        reason: 'Need more information',
        nextMessage: 'Let me understand the requirements...',
      });

      expect(updateChatMode).toHaveBeenCalledWith({
        id: 'test-chat',
        mode: 'discovery',
      });

      expect(result.mode).toBe('discovery');
      expect(result.message).toContain('discovery mode');
    });

    it('should handle empty nextMessage', async () => {
      const result = await tool.execute({
        mode: 'build',
        reason: 'Switching modes',
        nextMessage: '', // Empty string
      });

      // Should NOT emit continuation for empty message
      expect(mockDataStream.write).toHaveBeenCalledTimes(1);
      expect(result.continuation).toBeNull();
    });
  });

  describe('error handling', () => {
    it('should handle DB update failure gracefully', async () => {
      (updateChatMode as any).mockRejectedValue(new Error('DB Error'));

      await expect(
        tool.execute({
          mode: 'build',
          reason: 'Test',
        }),
      ).rejects.toThrow('DB Error');

      // Should not emit any events on DB failure
      expect(mockDataStream.write).not.toHaveBeenCalled();
    });
  });
});
