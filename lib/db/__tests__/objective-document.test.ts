import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies FIRST
vi.mock('server-only', () => ({}));

// Mock database
vi.mock('@/lib/db/queries', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    transaction: vi.fn(),
  },
}));

// Import after mocks
import {
  createObjectiveDocument,
  createDocumentVersion,
  getDocumentByObjectiveId,
  getLatestVersion,
  deleteVersionsByChatId,
} from '../objective-document';
import { db } from '@/lib/db/queries';
import { ChatSDKError } from '@/lib/errors';

describe('Objective Document DAL Functions', () => {
  const mockDb = db as any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createObjectiveDocument', () => {
    it('should create document + version + update objective in transaction', async () => {
      const mockDocument = {
        id: 'doc-1',
        workspaceId: 'ws-1',
        title: 'Test Document',
        createdByUserId: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockVersion = {
        id: 'ver-1',
        documentId: 'doc-1',
        chatId: 'chat-1',
        content: 'Test content',
        versionNumber: 1,
        createdByUserId: 'user-1',
        createdAt: new Date(),
        metadata: null,
      };

      // Mock transaction
      const mockTransaction = vi.fn(async (callback) => {
        const mockTx = {
          insert: vi.fn(),
          update: vi.fn(),
        };

        // Mock document insert
        const mockDocReturning = vi.fn().mockResolvedValue([mockDocument]);
        const mockDocValues = vi
          .fn()
          .mockReturnValue({ returning: mockDocReturning });
        mockTx.insert.mockReturnValueOnce({ values: mockDocValues });

        // Mock version insert
        const mockVerReturning = vi.fn().mockResolvedValue([mockVersion]);
        const mockVerValues = vi
          .fn()
          .mockReturnValue({ returning: mockVerReturning });
        mockTx.insert.mockReturnValueOnce({ values: mockVerValues });

        // Mock objective update
        const mockWhere = vi.fn().mockResolvedValue(undefined);
        const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
        mockTx.update.mockReturnValue({ set: mockSet });

        return await callback(mockTx);
      });

      mockDb.transaction = mockTransaction;

      const result = await createObjectiveDocument('obj-1', 'ws-1', 'user-1', {
        title: 'Test Document',
        content: 'Test content',
        chatId: 'chat-1',
      });

      expect(result).toEqual({
        document: mockDocument,
        version: mockVersion,
      });
      expect(mockTransaction).toHaveBeenCalled();
    });

    it('should create document without optional chatId', async () => {
      const mockDocument = {
        id: 'doc-2',
        workspaceId: 'ws-1',
        title: 'No Chat Document',
        createdByUserId: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockVersion = {
        id: 'ver-2',
        documentId: 'doc-2',
        chatId: null,
        content: 'Content without chat',
        versionNumber: 1,
        createdByUserId: 'user-1',
        createdAt: new Date(),
        metadata: null,
      };

      const mockTransaction = vi.fn(async (callback) => {
        const mockTx = {
          insert: vi.fn(),
          update: vi.fn(),
        };

        const mockDocReturning = vi.fn().mockResolvedValue([mockDocument]);
        const mockDocValues = vi
          .fn()
          .mockReturnValue({ returning: mockDocReturning });
        mockTx.insert.mockReturnValueOnce({ values: mockDocValues });

        const mockVerReturning = vi.fn().mockResolvedValue([mockVersion]);
        const mockVerValues = vi
          .fn()
          .mockReturnValue({ returning: mockVerReturning });
        mockTx.insert.mockReturnValueOnce({ values: mockVerValues });

        const mockWhere = vi.fn().mockResolvedValue(undefined);
        const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
        mockTx.update.mockReturnValue({ set: mockSet });

        return await callback(mockTx);
      });

      mockDb.transaction = mockTransaction;

      const result = await createObjectiveDocument('obj-1', 'ws-1', 'user-1', {
        title: 'No Chat Document',
        content: 'Content without chat',
      });

      expect(result.version.chatId).toBeNull();
      expect(result.version.versionNumber).toBe(1);
    });

    it('should start versionNumber at 1 for first version', async () => {
      const mockDocument = {
        id: 'doc-3',
        workspaceId: 'ws-1',
        title: 'First Version',
        createdByUserId: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockVersion = {
        id: 'ver-3',
        documentId: 'doc-3',
        chatId: 'chat-1',
        content: 'First version content',
        versionNumber: 1,
        createdByUserId: 'user-1',
        createdAt: new Date(),
        metadata: null,
      };

      const mockTransaction = vi.fn(async (callback) => {
        const mockTx = {
          insert: vi.fn(),
          update: vi.fn(),
        };

        const mockDocReturning = vi.fn().mockResolvedValue([mockDocument]);
        const mockDocValues = vi
          .fn()
          .mockReturnValue({ returning: mockDocReturning });
        mockTx.insert.mockReturnValueOnce({ values: mockDocValues });

        const mockVerReturning = vi.fn().mockResolvedValue([mockVersion]);
        const mockVerValues = vi
          .fn()
          .mockReturnValue({ returning: mockVerReturning });
        mockTx.insert.mockReturnValueOnce({ values: mockVerValues });

        const mockWhere = vi.fn().mockResolvedValue(undefined);
        const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
        mockTx.update.mockReturnValue({ set: mockSet });

        return await callback(mockTx);
      });

      mockDb.transaction = mockTransaction;

      const result = await createObjectiveDocument('obj-1', 'ws-1', 'user-1', {
        title: 'First Version',
        content: 'First version content',
        chatId: 'chat-1',
      });

      expect(result.version.versionNumber).toBe(1);
    });

    it('should throw ChatSDKError on database failure', async () => {
      const mockTransaction = vi
        .fn()
        .mockRejectedValue(new Error('Database error'));
      mockDb.transaction = mockTransaction;

      try {
        await createObjectiveDocument('obj-1', 'ws-1', 'user-1', {
          title: 'Should Fail',
          content: 'Should not be created',
        });
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(ChatSDKError);
        expect((error as ChatSDKError).type).toBe('bad_request');
        expect((error as ChatSDKError).surface).toBe('database');
        expect((error as ChatSDKError).cause).toBe(
          'Failed to create objective document',
        );
      }
    });
  });

  describe('createDocumentVersion', () => {
    it('should auto-increment versionNumber from max version', async () => {
      const mockMaxResult = { maxVersion: 3 };
      const mockVersion = {
        id: 'ver-4',
        documentId: 'doc-1',
        chatId: 'chat-1',
        content: 'Version 4 content',
        versionNumber: 4,
        createdByUserId: 'user-1',
        createdAt: new Date(),
        metadata: null,
      };

      // Mock max version query
      const mockWhere1 = vi.fn().mockResolvedValue([mockMaxResult]);
      const mockFrom1 = vi.fn().mockReturnValue({ where: mockWhere1 });
      const mockSelect = vi.fn().mockReturnValue({ from: mockFrom1 });

      // Mock version insert
      const mockReturning = vi.fn().mockResolvedValue([mockVersion]);
      const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
      const mockInsert = vi.fn().mockReturnValue({ values: mockValues });

      // Mock document update
      const mockWhere2 = vi.fn().mockResolvedValue(undefined);
      const mockSet = vi.fn().mockReturnValue({ where: mockWhere2 });
      const mockUpdate = vi.fn().mockReturnValue({ set: mockSet });

      mockDb.select = mockSelect;
      mockDb.insert = mockInsert;
      mockDb.update = mockUpdate;

      const result = await createDocumentVersion('doc-1', 'chat-1', 'user-1', {
        content: 'Version 4 content',
      });

      expect(result.versionNumber).toBe(4);
      expect(mockSelect).toHaveBeenCalled();
      expect(mockInsert).toHaveBeenCalled();
      expect(mockUpdate).toHaveBeenCalled();
    });

    it('should handle first version when no max exists (null)', async () => {
      const mockMaxResult = { maxVersion: null };
      const mockVersion = {
        id: 'ver-1',
        documentId: 'doc-new',
        chatId: 'chat-1',
        content: 'First version',
        versionNumber: 1,
        createdByUserId: 'user-1',
        createdAt: new Date(),
        metadata: null,
      };

      const mockWhere1 = vi.fn().mockResolvedValue([mockMaxResult]);
      const mockFrom1 = vi.fn().mockReturnValue({ where: mockWhere1 });
      const mockSelect = vi.fn().mockReturnValue({ from: mockFrom1 });

      const mockReturning = vi.fn().mockResolvedValue([mockVersion]);
      const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
      const mockInsert = vi.fn().mockReturnValue({ values: mockValues });

      const mockWhere2 = vi.fn().mockResolvedValue(undefined);
      const mockSet = vi.fn().mockReturnValue({ where: mockWhere2 });
      const mockUpdate = vi.fn().mockReturnValue({ set: mockSet });

      mockDb.select = mockSelect;
      mockDb.insert = mockInsert;
      mockDb.update = mockUpdate;

      const result = await createDocumentVersion(
        'doc-new',
        'chat-1',
        'user-1',
        {
          content: 'First version',
        },
      );

      expect(result.versionNumber).toBe(1);
    });

    it('should include optional metadata when provided', async () => {
      const metadata = { key: 'value', nested: { data: 123 } };
      const mockMaxResult = { maxVersion: 1 };
      const mockVersion = {
        id: 'ver-2',
        documentId: 'doc-1',
        chatId: 'chat-1',
        content: 'Version with metadata',
        versionNumber: 2,
        createdByUserId: 'user-1',
        createdAt: new Date(),
        metadata,
      };

      const mockWhere1 = vi.fn().mockResolvedValue([mockMaxResult]);
      const mockFrom1 = vi.fn().mockReturnValue({ where: mockWhere1 });
      const mockSelect = vi.fn().mockReturnValue({ from: mockFrom1 });

      const mockReturning = vi.fn().mockResolvedValue([mockVersion]);
      const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
      const mockInsert = vi.fn().mockReturnValue({ values: mockValues });

      const mockWhere2 = vi.fn().mockResolvedValue(undefined);
      const mockSet = vi.fn().mockReturnValue({ where: mockWhere2 });
      const mockUpdate = vi.fn().mockReturnValue({ set: mockSet });

      mockDb.select = mockSelect;
      mockDb.insert = mockInsert;
      mockDb.update = mockUpdate;

      const result = await createDocumentVersion('doc-1', 'chat-1', 'user-1', {
        content: 'Version with metadata',
        metadata,
      });

      expect(result.metadata).toEqual(metadata);
    });

    it('should update document updatedAt timestamp', async () => {
      const mockMaxResult = { maxVersion: 5 };
      const mockVersion = {
        id: 'ver-6',
        documentId: 'doc-1',
        chatId: 'chat-1',
        content: 'New version',
        versionNumber: 6,
        createdByUserId: 'user-1',
        createdAt: new Date(),
        metadata: null,
      };

      const mockWhere1 = vi.fn().mockResolvedValue([mockMaxResult]);
      const mockFrom1 = vi.fn().mockReturnValue({ where: mockWhere1 });
      const mockSelect = vi.fn().mockReturnValue({ from: mockFrom1 });

      const mockReturning = vi.fn().mockResolvedValue([mockVersion]);
      const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
      const mockInsert = vi.fn().mockReturnValue({ values: mockValues });

      const mockWhere2 = vi.fn().mockResolvedValue(undefined);
      const mockSet = vi.fn().mockReturnValue({ where: mockWhere2 });
      const mockUpdate = vi.fn().mockReturnValue({ set: mockSet });

      mockDb.select = mockSelect;
      mockDb.insert = mockInsert;
      mockDb.update = mockUpdate;

      await createDocumentVersion('doc-1', 'chat-1', 'user-1', {
        content: 'New version',
      });

      expect(mockUpdate).toHaveBeenCalled();
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          updatedAt: expect.any(Date),
        }),
      );
    });

    it('should throw ChatSDKError on database failure', async () => {
      const mockWhere = vi.fn().mockRejectedValue(new Error('Database error'));
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });

      mockDb.select = mockSelect;

      try {
        await createDocumentVersion('doc-1', 'chat-1', 'user-1', {
          content: 'Should fail',
        });
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(ChatSDKError);
        expect((error as ChatSDKError).type).toBe('bad_request');
        expect((error as ChatSDKError).surface).toBe('database');
        expect((error as ChatSDKError).cause).toBe(
          'Failed to create document version',
        );
      }
    });
  });

  describe('getDocumentByObjectiveId', () => {
    it('should return null when objective has no objectiveDocumentId', async () => {
      const mockObjective = {
        id: 'obj-1',
        objectiveDocumentId: null,
      };

      const mockLimit = vi.fn().mockResolvedValue([mockObjective]);
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });

      mockDb.select = mockSelect;

      const result = await getDocumentByObjectiveId('obj-1');

      expect(result).toBeNull();
    });

    it('should return null when objective does not exist', async () => {
      const mockLimit = vi.fn().mockResolvedValue([]);
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });

      mockDb.select = mockSelect;

      const result = await getDocumentByObjectiveId('nonexistent');

      expect(result).toBeNull();
    });

    it('should return document with all versions and latestVersion', async () => {
      const mockObjective = {
        id: 'obj-1',
        objectiveDocumentId: 'doc-1',
      };

      const mockDocument = {
        id: 'doc-1',
        workspaceId: 'ws-1',
        title: 'Test Document',
        createdByUserId: 'user-1',
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-03'),
      };

      const mockVersions = [
        {
          id: 'ver-3',
          documentId: 'doc-1',
          chatId: 'chat-1',
          content: 'Version 3 (latest)',
          versionNumber: 3,
          createdByUserId: 'user-1',
          createdAt: new Date('2025-01-03'),
          metadata: null,
        },
        {
          id: 'ver-2',
          documentId: 'doc-1',
          chatId: 'chat-1',
          content: 'Version 2',
          versionNumber: 2,
          createdByUserId: 'user-1',
          createdAt: new Date('2025-01-02'),
          metadata: null,
        },
        {
          id: 'ver-1',
          documentId: 'doc-1',
          chatId: 'chat-1',
          content: 'Version 1',
          versionNumber: 1,
          createdByUserId: 'user-1',
          createdAt: new Date('2025-01-01'),
          metadata: null,
        },
      ];

      // Mock objective query
      const mockLimit1 = vi.fn().mockResolvedValue([mockObjective]);
      const mockWhere1 = vi.fn().mockReturnValue({ limit: mockLimit1 });
      const mockFrom1 = vi.fn().mockReturnValue({ where: mockWhere1 });

      // Mock document query
      const mockLimit2 = vi.fn().mockResolvedValue([mockDocument]);
      const mockWhere2 = vi.fn().mockReturnValue({ limit: mockLimit2 });
      const mockFrom2 = vi.fn().mockReturnValue({ where: mockWhere2 });

      // Mock versions query
      const mockOrderBy = vi.fn().mockResolvedValue(mockVersions);
      const mockWhere3 = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      const mockFrom3 = vi.fn().mockReturnValue({ where: mockWhere3 });

      const mockSelect = vi
        .fn()
        .mockReturnValueOnce({ from: mockFrom1 })
        .mockReturnValueOnce({ from: mockFrom2 })
        .mockReturnValueOnce({ from: mockFrom3 });

      mockDb.select = mockSelect;

      const result = await getDocumentByObjectiveId('obj-1');

      expect(result).not.toBeNull();
      expect(result?.document).toEqual(mockDocument);
      expect(result?.versions).toEqual(mockVersions);
      expect(result?.latestVersion).toEqual(mockVersions[0]);
      expect(result?.latestVersion?.versionNumber).toBe(3);
    });

    it('should handle document with single version', async () => {
      const mockObjective = {
        id: 'obj-1',
        objectiveDocumentId: 'doc-1',
      };

      const mockDocument = {
        id: 'doc-1',
        workspaceId: 'ws-1',
        title: 'Single Version Document',
        createdByUserId: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockVersions = [
        {
          id: 'ver-1',
          documentId: 'doc-1',
          chatId: 'chat-1',
          content: 'Only version',
          versionNumber: 1,
          createdByUserId: 'user-1',
          createdAt: new Date(),
          metadata: null,
        },
      ];

      const mockLimit1 = vi.fn().mockResolvedValue([mockObjective]);
      const mockWhere1 = vi.fn().mockReturnValue({ limit: mockLimit1 });
      const mockFrom1 = vi.fn().mockReturnValue({ where: mockWhere1 });

      const mockLimit2 = vi.fn().mockResolvedValue([mockDocument]);
      const mockWhere2 = vi.fn().mockReturnValue({ limit: mockLimit2 });
      const mockFrom2 = vi.fn().mockReturnValue({ where: mockWhere2 });

      const mockOrderBy = vi.fn().mockResolvedValue(mockVersions);
      const mockWhere3 = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      const mockFrom3 = vi.fn().mockReturnValue({ where: mockWhere3 });

      const mockSelect = vi
        .fn()
        .mockReturnValueOnce({ from: mockFrom1 })
        .mockReturnValueOnce({ from: mockFrom2 })
        .mockReturnValueOnce({ from: mockFrom3 });

      mockDb.select = mockSelect;

      const result = await getDocumentByObjectiveId('obj-1');

      expect(result?.versions.length).toBe(1);
      expect(result?.latestVersion).toEqual(mockVersions[0]);
    });

    it('should throw ChatSDKError on database failure', async () => {
      const mockWhere = vi.fn().mockRejectedValue(new Error('Database error'));
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });

      mockDb.select = mockSelect;

      try {
        await getDocumentByObjectiveId('obj-1');
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(ChatSDKError);
        expect((error as ChatSDKError).type).toBe('bad_request');
        expect((error as ChatSDKError).surface).toBe('database');
        expect((error as ChatSDKError).cause).toBe(
          'Failed to get document by objective',
        );
      }
    });
  });

  describe('getLatestVersion', () => {
    it('should return most recent version by createdAt DESC', async () => {
      const mockVersion = {
        id: 'ver-5',
        documentId: 'doc-1',
        chatId: 'chat-1',
        content: 'Latest version',
        versionNumber: 5,
        createdByUserId: 'user-1',
        createdAt: new Date('2025-01-05'),
        metadata: null,
      };

      const mockLimit = vi.fn().mockResolvedValue([mockVersion]);
      const mockOrderBy = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });

      mockDb.select = mockSelect;

      const result = await getLatestVersion('doc-1');

      expect(result).toEqual(mockVersion);
      expect(result?.versionNumber).toBe(5);
    });

    it('should return null when no versions exist', async () => {
      const mockLimit = vi.fn().mockResolvedValue([]);
      const mockOrderBy = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });

      mockDb.select = mockSelect;

      const result = await getLatestVersion('doc-empty');

      expect(result).toBeNull();
    });

    it('should return null when document does not exist', async () => {
      const mockLimit = vi.fn().mockResolvedValue([]);
      const mockOrderBy = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });

      mockDb.select = mockSelect;

      const result = await getLatestVersion('nonexistent');

      expect(result).toBeNull();
    });

    it('should throw ChatSDKError on database failure', async () => {
      const mockWhere = vi.fn().mockRejectedValue(new Error('Database error'));
      const mockOrderBy = vi.fn().mockReturnValue({ limit: vi.fn() });
      const mockFrom = vi
        .fn()
        .mockReturnValue({ where: mockWhere, orderBy: mockOrderBy });
      const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });

      mockDb.select = mockSelect;

      try {
        await getLatestVersion('doc-1');
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(ChatSDKError);
        expect((error as ChatSDKError).type).toBe('bad_request');
        expect((error as ChatSDKError).surface).toBe('database');
        expect((error as ChatSDKError).cause).toBe(
          'Failed to get latest version',
        );
      }
    });
  });

  describe('deleteVersionsByChatId', () => {
    it('should delete all versions for a chatId', async () => {
      const mockWhere = vi.fn().mockResolvedValue(undefined);
      const mockDelete = vi.fn().mockReturnValue({ where: mockWhere });

      mockDb.delete = mockDelete;

      await deleteVersionsByChatId('chat-1');

      expect(mockDelete).toHaveBeenCalled();
      expect(mockWhere).toHaveBeenCalled();
    });

    it('should handle chatId with no versions (no-op)', async () => {
      const mockWhere = vi.fn().mockResolvedValue(undefined);
      const mockDelete = vi.fn().mockReturnValue({ where: mockWhere });

      mockDb.delete = mockDelete;

      await deleteVersionsByChatId('chat-empty');

      expect(mockDelete).toHaveBeenCalled();
      expect(mockWhere).toHaveBeenCalled();
    });

    it('should throw ChatSDKError on database failure', async () => {
      const mockWhere = vi.fn().mockRejectedValue(new Error('Database error'));
      const mockDelete = vi.fn().mockReturnValue({ where: mockWhere });

      mockDb.delete = mockDelete;

      try {
        await deleteVersionsByChatId('chat-1');
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(ChatSDKError);
        expect((error as ChatSDKError).type).toBe('bad_request');
        expect((error as ChatSDKError).surface).toBe('database');
        expect((error as ChatSDKError).cause).toBe(
          'Failed to delete versions by chat',
        );
      }
    });
  });
});
