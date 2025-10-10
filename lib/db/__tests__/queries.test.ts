import { describe, it, expect, vi, beforeEach } from 'vitest';

// Create mock db instance using hoisted
const mockDbInstance = vi.hoisted(() => ({
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
}));

// Mock dependencies FIRST
vi.mock('server-only', () => ({}));

// Mock logger
vi.mock('@/lib/logger', () => ({
  getLogger: vi.fn(() => ({
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  })),
}));

// Mock drizzle to return our mock instance
vi.mock('drizzle-orm/vercel-postgres', () => ({
  drizzle: vi.fn(() => mockDbInstance),
}));

// Mock @vercel/postgres
vi.mock('@vercel/postgres', () => ({
  sql: {},
}));

// Mock objective-document
vi.mock('../objective-document', () => ({
  deleteVersionsByChatId: vi.fn(),
}));

// Import after mocks
import { getChatByIdWithWorkspace } from '../queries';
import { ChatSDKError } from '@/lib/errors';

describe('Query Helper Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getChatByIdWithWorkspace', () => {
    it('should return chat when all params match (id, workspace, user)', async () => {
      const mockChat = {
        id: 'chat-123',
        userId: 'user-456',
        objectiveId: 'obj-789',
        title: 'Test Chat',
        visibility: 'private' as const,
        createdAt: new Date(),
        mode: 'discovery',
        modeSetAt: new Date(),
        goal: null,
        goalSetAt: null,
        todoList: null,
        todoListUpdatedAt: null,
        complete: false,
        completedAt: null,
        firstCompletedAt: null,
      };

      const mockResult = [{ chat: mockChat }];

      // Mock the query chain
      const mockLimit = vi.fn().mockResolvedValue(mockResult);
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockInnerJoin = vi.fn().mockReturnValue({ where: mockWhere });
      const mockFrom = vi.fn().mockReturnValue({ innerJoin: mockInnerJoin });
      const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });

      mockDbInstance.select = mockSelect;

      const result = await getChatByIdWithWorkspace({
        id: 'chat-123',
        workspaceId: 'ws-abc',
        userId: 'user-456',
      });

      expect(result).toEqual(mockChat);
      expect(mockSelect).toHaveBeenCalled();
      expect(mockInnerJoin).toHaveBeenCalled();
      expect(mockWhere).toHaveBeenCalled();
      expect(mockLimit).toHaveBeenCalled();
    });

    it('should return null when chat does not exist', async () => {
      const mockLimit = vi.fn().mockResolvedValue([]);
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockInnerJoin = vi.fn().mockReturnValue({ where: mockWhere });
      const mockFrom = vi.fn().mockReturnValue({ innerJoin: mockInnerJoin });
      const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });

      mockDbInstance.select = mockSelect;

      const result = await getChatByIdWithWorkspace({
        id: 'nonexistent-chat',
        workspaceId: 'ws-abc',
        userId: 'user-456',
      });

      expect(result).toBeNull();
    });

    it('should return null when chat exists but belongs to different workspace', async () => {
      // Empty result because workspace doesn't match
      const mockLimit = vi.fn().mockResolvedValue([]);
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockInnerJoin = vi.fn().mockReturnValue({ where: mockWhere });
      const mockFrom = vi.fn().mockReturnValue({ innerJoin: mockInnerJoin });
      const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });

      mockDbInstance.select = mockSelect;

      const result = await getChatByIdWithWorkspace({
        id: 'chat-123',
        workspaceId: 'wrong-workspace',
        userId: 'user-456',
      });

      expect(result).toBeNull();
    });

    it('should return null when chat exists but belongs to different user', async () => {
      // Empty result because userId doesn't match
      const mockLimit = vi.fn().mockResolvedValue([]);
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockInnerJoin = vi.fn().mockReturnValue({ where: mockWhere });
      const mockFrom = vi.fn().mockReturnValue({ innerJoin: mockInnerJoin });
      const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });

      mockDbInstance.select = mockSelect;

      const result = await getChatByIdWithWorkspace({
        id: 'chat-123',
        workspaceId: 'ws-abc',
        userId: 'wrong-user',
      });

      expect(result).toBeNull();
    });

    it('should throw ChatSDKError with code bad_request:database on database failure', async () => {
      // Mock database error
      const mockLimit = vi
        .fn()
        .mockRejectedValue(new Error('Database connection failed'));
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockInnerJoin = vi.fn().mockReturnValue({ where: mockWhere });
      const mockFrom = vi.fn().mockReturnValue({ innerJoin: mockInnerJoin });
      const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });

      mockDbInstance.select = mockSelect;

      try {
        await getChatByIdWithWorkspace({
          id: 'chat-123',
          workspaceId: 'ws-abc',
          userId: 'user-456',
        });
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(ChatSDKError);
        expect((error as ChatSDKError).type).toBe('bad_request');
        expect((error as ChatSDKError).surface).toBe('database');
        expect((error as ChatSDKError).cause).toBe(
          'Failed to get chat by id with workspace',
        );
      }
    });
  });
});
