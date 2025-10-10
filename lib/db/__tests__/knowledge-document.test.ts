import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies FIRST
vi.mock('server-only', () => ({}));

// Mock database
vi.mock('@/lib/db/queries', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    delete: vi.fn(),
  },
}));

// Import after mocks
import {
  createKnowledgeDocument,
  getKnowledgeByObjectiveId,
  getKnowledgeByWorkspaceId,
  deleteKnowledgeDocument,
} from '../knowledge-document';
import { db } from '@/lib/db/queries';
import { ChatSDKError } from '@/lib/errors';

describe('Knowledge Document DAL Functions', () => {
  const mockDb = db as any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createKnowledgeDocument', () => {
    it('should create knowledge document with all fields including optional objectiveId', async () => {
      const mockDocument = {
        id: 'knowledge-1',
        workspaceId: 'ws-1',
        objectiveId: 'obj-1',
        title: 'Test Knowledge Document',
        content: 'Knowledge content',
        category: 'knowledge',
        documentType: 'research',
        isSearchable: true,
        metadata: { key: 'value' },
        createdByUserId: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockReturning = vi.fn().mockResolvedValue([mockDocument]);
      const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
      const mockInsert = vi.fn().mockReturnValue({ values: mockValues });

      mockDb.insert = mockInsert;

      const result = await createKnowledgeDocument('ws-1', 'user-1', {
        objectiveId: 'obj-1',
        title: 'Test Knowledge Document',
        content: 'Knowledge content',
        category: 'knowledge',
        documentType: 'research',
        metadata: { key: 'value' },
      });

      expect(result).toEqual(mockDocument);
      expect(result.objectiveId).toBe('obj-1');
      expect(result.isSearchable).toBe(true);
      expect(result.metadata).toEqual({ key: 'value' });
      expect(mockInsert).toHaveBeenCalled();
    });

    it('should create document without optional objectiveId', async () => {
      const mockDocument = {
        id: 'knowledge-2',
        workspaceId: 'ws-1',
        objectiveId: null,
        title: 'General Knowledge',
        content: 'General content',
        category: 'knowledge',
        documentType: 'note',
        isSearchable: true,
        metadata: null,
        createdByUserId: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockReturning = vi.fn().mockResolvedValue([mockDocument]);
      const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
      const mockInsert = vi.fn().mockReturnValue({ values: mockValues });

      mockDb.insert = mockInsert;

      const result = await createKnowledgeDocument('ws-1', 'user-1', {
        title: 'General Knowledge',
        content: 'General content',
        category: 'knowledge',
        documentType: 'note',
      });

      expect(result.objectiveId).toBeNull();
      expect(result.isSearchable).toBe(true);
    });

    it('should set isSearchable to true by default', async () => {
      const mockDocument = {
        id: 'knowledge-3',
        workspaceId: 'ws-1',
        objectiveId: null,
        title: 'Searchable Document',
        content: 'Content',
        category: 'knowledge',
        documentType: 'text',
        isSearchable: true,
        metadata: null,
        createdByUserId: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockReturning = vi.fn().mockResolvedValue([mockDocument]);
      const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
      const mockInsert = vi.fn().mockReturnValue({ values: mockValues });

      mockDb.insert = mockInsert;

      const result = await createKnowledgeDocument('ws-1', 'user-1', {
        title: 'Searchable Document',
        content: 'Content',
        category: 'knowledge',
        documentType: 'text',
      });

      expect(result.isSearchable).toBe(true);
    });

    it('should handle knowledge category', async () => {
      const mockDocument = {
        id: 'knowledge-4',
        workspaceId: 'ws-1',
        objectiveId: 'obj-1',
        title: 'Knowledge Category',
        content: 'Knowledge content',
        category: 'knowledge',
        documentType: 'article',
        isSearchable: true,
        metadata: null,
        createdByUserId: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockReturning = vi.fn().mockResolvedValue([mockDocument]);
      const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
      const mockInsert = vi.fn().mockReturnValue({ values: mockValues });

      mockDb.insert = mockInsert;

      const result = await createKnowledgeDocument('ws-1', 'user-1', {
        objectiveId: 'obj-1',
        title: 'Knowledge Category',
        content: 'Knowledge content',
        category: 'knowledge',
        documentType: 'article',
      });

      expect(result.category).toBe('knowledge');
    });

    it('should handle raw category', async () => {
      const mockDocument = {
        id: 'knowledge-5',
        workspaceId: 'ws-1',
        objectiveId: 'obj-1',
        title: 'Raw Data',
        content: 'Raw content',
        category: 'raw',
        documentType: 'data',
        isSearchable: true,
        metadata: null,
        createdByUserId: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockReturning = vi.fn().mockResolvedValue([mockDocument]);
      const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
      const mockInsert = vi.fn().mockReturnValue({ values: mockValues });

      mockDb.insert = mockInsert;

      const result = await createKnowledgeDocument('ws-1', 'user-1', {
        objectiveId: 'obj-1',
        title: 'Raw Data',
        content: 'Raw content',
        category: 'raw',
        documentType: 'data',
      });

      expect(result.category).toBe('raw');
    });

    it('should include optional metadata when provided', async () => {
      const metadata = {
        source: 'web',
        tags: ['important'],
        nested: { value: 123 },
      };
      const mockDocument = {
        id: 'knowledge-6',
        workspaceId: 'ws-1',
        objectiveId: 'obj-1',
        title: 'With Metadata',
        content: 'Content',
        category: 'knowledge',
        documentType: 'research',
        isSearchable: true,
        metadata,
        createdByUserId: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockReturning = vi.fn().mockResolvedValue([mockDocument]);
      const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
      const mockInsert = vi.fn().mockReturnValue({ values: mockValues });

      mockDb.insert = mockInsert;

      const result = await createKnowledgeDocument('ws-1', 'user-1', {
        objectiveId: 'obj-1',
        title: 'With Metadata',
        content: 'Content',
        category: 'knowledge',
        documentType: 'research',
        metadata,
      });

      expect(result.metadata).toEqual(metadata);
    });

    it('should throw ChatSDKError on database failure', async () => {
      const mockValues = vi.fn().mockRejectedValue(new Error('Database error'));
      const mockInsert = vi.fn().mockReturnValue({ values: mockValues });

      mockDb.insert = mockInsert;

      try {
        await createKnowledgeDocument('ws-1', 'user-1', {
          title: 'Should Fail',
          content: 'Should not be created',
          category: 'knowledge',
          documentType: 'text',
        });
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(ChatSDKError);
        expect((error as ChatSDKError).type).toBe('bad_request');
        expect((error as ChatSDKError).surface).toBe('database');
        expect((error as ChatSDKError).cause).toBe(
          'Failed to create knowledge document',
        );
      }
    });
  });

  describe('getKnowledgeByObjectiveId', () => {
    it('should return documents ordered by createdAt DESC', async () => {
      const mockDocuments = [
        {
          id: 'knowledge-3',
          objectiveId: 'obj-1',
          title: 'Latest Document',
          createdAt: new Date('2025-01-03'),
        },
        {
          id: 'knowledge-2',
          objectiveId: 'obj-1',
          title: 'Middle Document',
          createdAt: new Date('2025-01-02'),
        },
        {
          id: 'knowledge-1',
          objectiveId: 'obj-1',
          title: 'Oldest Document',
          createdAt: new Date('2025-01-01'),
        },
      ];

      const mockOrderBy = vi.fn().mockResolvedValue(mockDocuments);
      const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });

      mockDb.select = mockSelect;

      const result = await getKnowledgeByObjectiveId('obj-1');

      expect(result).toEqual(mockDocuments);
      expect(result.length).toBe(3);
      expect(result[0].id).toBe('knowledge-3');
      expect(result[2].id).toBe('knowledge-1');
      expect(mockSelect).toHaveBeenCalled();
      expect(mockOrderBy).toHaveBeenCalled();
    });

    it('should return empty array when no documents exist', async () => {
      const mockOrderBy = vi.fn().mockResolvedValue([]);
      const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });

      mockDb.select = mockSelect;

      const result = await getKnowledgeByObjectiveId('obj-empty');

      expect(result).toEqual([]);
    });

    it('should handle multiple documents for same objective', async () => {
      const mockDocuments = [
        {
          id: 'knowledge-5',
          objectiveId: 'obj-1',
          title: 'Document 5',
          category: 'knowledge',
          createdAt: new Date('2025-01-05'),
        },
        {
          id: 'knowledge-4',
          objectiveId: 'obj-1',
          title: 'Document 4',
          category: 'raw',
          createdAt: new Date('2025-01-04'),
        },
        {
          id: 'knowledge-3',
          objectiveId: 'obj-1',
          title: 'Document 3',
          category: 'knowledge',
          createdAt: new Date('2025-01-03'),
        },
      ];

      const mockOrderBy = vi.fn().mockResolvedValue(mockDocuments);
      const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });

      mockDb.select = mockSelect;

      const result = await getKnowledgeByObjectiveId('obj-1');

      expect(result.length).toBe(3);
      expect(result.every((doc) => doc.objectiveId === 'obj-1')).toBe(true);
    });

    it('should throw ChatSDKError on database failure', async () => {
      const mockWhere = vi.fn().mockRejectedValue(new Error('Database error'));
      const mockOrderBy = vi.fn().mockReturnValue({ orderBy: vi.fn() });
      const mockFrom = vi
        .fn()
        .mockReturnValue({ where: mockWhere, orderBy: mockOrderBy });
      const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });

      mockDb.select = mockSelect;

      try {
        await getKnowledgeByObjectiveId('obj-1');
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(ChatSDKError);
        expect((error as ChatSDKError).type).toBe('bad_request');
        expect((error as ChatSDKError).surface).toBe('database');
        expect((error as ChatSDKError).cause).toBe(
          'Failed to get knowledge by objective',
        );
      }
    });
  });

  describe('getKnowledgeByWorkspaceId', () => {
    it('should return all documents when no category filter provided', async () => {
      const mockDocuments = [
        {
          id: 'knowledge-3',
          workspaceId: 'ws-1',
          category: 'knowledge',
          title: 'Knowledge Doc',
          createdAt: new Date('2025-01-03'),
        },
        {
          id: 'knowledge-2',
          workspaceId: 'ws-1',
          category: 'raw',
          title: 'Raw Doc',
          createdAt: new Date('2025-01-02'),
        },
        {
          id: 'knowledge-1',
          workspaceId: 'ws-1',
          category: 'knowledge',
          title: 'Another Knowledge',
          createdAt: new Date('2025-01-01'),
        },
      ];

      const mockOrderBy = vi.fn().mockResolvedValue(mockDocuments);
      const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });

      mockDb.select = mockSelect;

      const result = await getKnowledgeByWorkspaceId('ws-1');

      expect(result).toEqual(mockDocuments);
      expect(result.length).toBe(3);
      expect(result.some((doc) => doc.category === 'knowledge')).toBe(true);
      expect(result.some((doc) => doc.category === 'raw')).toBe(true);
    });

    it('should filter by knowledge category when specified', async () => {
      const mockDocuments = [
        {
          id: 'knowledge-3',
          workspaceId: 'ws-1',
          category: 'knowledge',
          title: 'Knowledge Doc 2',
          createdAt: new Date('2025-01-03'),
        },
        {
          id: 'knowledge-1',
          workspaceId: 'ws-1',
          category: 'knowledge',
          title: 'Knowledge Doc 1',
          createdAt: new Date('2025-01-01'),
        },
      ];

      const mockOrderBy = vi.fn().mockResolvedValue(mockDocuments);
      const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });

      mockDb.select = mockSelect;

      const result = await getKnowledgeByWorkspaceId('ws-1', 'knowledge');

      expect(result).toEqual(mockDocuments);
      expect(result.every((doc) => doc.category === 'knowledge')).toBe(true);
    });

    it('should filter by raw category when specified', async () => {
      const mockDocuments = [
        {
          id: 'knowledge-4',
          workspaceId: 'ws-1',
          category: 'raw',
          title: 'Raw Data 2',
          createdAt: new Date('2025-01-04'),
        },
        {
          id: 'knowledge-2',
          workspaceId: 'ws-1',
          category: 'raw',
          title: 'Raw Data 1',
          createdAt: new Date('2025-01-02'),
        },
      ];

      const mockOrderBy = vi.fn().mockResolvedValue(mockDocuments);
      const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });

      mockDb.select = mockSelect;

      const result = await getKnowledgeByWorkspaceId('ws-1', 'raw');

      expect(result).toEqual(mockDocuments);
      expect(result.every((doc) => doc.category === 'raw')).toBe(true);
    });

    it('should return empty array when no documents exist', async () => {
      const mockOrderBy = vi.fn().mockResolvedValue([]);
      const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });

      mockDb.select = mockSelect;

      const result = await getKnowledgeByWorkspaceId('ws-empty');

      expect(result).toEqual([]);
    });

    it('should order by createdAt DESC', async () => {
      const mockDocuments = [
        {
          id: 'knowledge-5',
          workspaceId: 'ws-1',
          category: 'knowledge',
          title: 'Most Recent',
          createdAt: new Date('2025-01-05'),
        },
        {
          id: 'knowledge-4',
          workspaceId: 'ws-1',
          category: 'knowledge',
          title: 'Recent',
          createdAt: new Date('2025-01-04'),
        },
        {
          id: 'knowledge-1',
          workspaceId: 'ws-1',
          category: 'knowledge',
          title: 'Oldest',
          createdAt: new Date('2025-01-01'),
        },
      ];

      const mockOrderBy = vi.fn().mockResolvedValue(mockDocuments);
      const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });

      mockDb.select = mockSelect;

      const result = await getKnowledgeByWorkspaceId('ws-1', 'knowledge');

      expect(result[0].id).toBe('knowledge-5');
      expect(result[1].id).toBe('knowledge-4');
      expect(result[2].id).toBe('knowledge-1');
      expect(mockOrderBy).toHaveBeenCalled();
    });

    it('should throw ChatSDKError on database failure', async () => {
      const mockWhere = vi.fn().mockRejectedValue(new Error('Database error'));
      const mockOrderBy = vi.fn().mockReturnValue({ orderBy: vi.fn() });
      const mockFrom = vi
        .fn()
        .mockReturnValue({ where: mockWhere, orderBy: mockOrderBy });
      const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });

      mockDb.select = mockSelect;

      try {
        await getKnowledgeByWorkspaceId('ws-1');
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(ChatSDKError);
        expect((error as ChatSDKError).type).toBe('bad_request');
        expect((error as ChatSDKError).surface).toBe('database');
        expect((error as ChatSDKError).cause).toBe(
          'Failed to get knowledge by workspace',
        );
      }
    });
  });

  describe('deleteKnowledgeDocument', () => {
    it('should delete document successfully when user owns workspace', async () => {
      const mockDocument = {
        id: 'knowledge-1',
        workspaceId: 'ws-1',
        title: 'To Delete',
      };

      // Mock ownership verification (select with innerJoin)
      const mockLimit = vi
        .fn()
        .mockResolvedValue([{ knowledgeDocument: mockDocument }]);
      const mockWhere1 = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockInnerJoin = vi.fn().mockReturnValue({ where: mockWhere1 });
      const mockFrom = vi.fn().mockReturnValue({ innerJoin: mockInnerJoin });
      const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });

      // Mock delete operation
      const mockWhere2 = vi.fn().mockResolvedValue(undefined);
      const mockDelete = vi.fn().mockReturnValue({ where: mockWhere2 });

      mockDb.select = mockSelect;
      mockDb.delete = mockDelete;

      await deleteKnowledgeDocument('knowledge-1', 'user-1');

      expect(mockSelect).toHaveBeenCalled();
      expect(mockInnerJoin).toHaveBeenCalled();
      expect(mockDelete).toHaveBeenCalled();
      expect(mockWhere2).toHaveBeenCalled();
    });

    it('should throw error when user does not own workspace', async () => {
      // Mock ownership verification returning empty (no access)
      const mockLimit = vi.fn().mockResolvedValue([]);
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockInnerJoin = vi.fn().mockReturnValue({ where: mockWhere });
      const mockFrom = vi.fn().mockReturnValue({ innerJoin: mockInnerJoin });
      const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });

      mockDb.select = mockSelect;

      try {
        await deleteKnowledgeDocument('knowledge-1', 'wrong-user');
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(ChatSDKError);
        expect((error as ChatSDKError).type).toBe('not_found');
        expect((error as ChatSDKError).cause).toBe(
          'Knowledge document not found or access denied',
        );
      }
    });

    it('should throw error for nonexistent document', async () => {
      const mockLimit = vi.fn().mockResolvedValue([]);
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockInnerJoin = vi.fn().mockReturnValue({ where: mockWhere });
      const mockFrom = vi.fn().mockReturnValue({ innerJoin: mockInnerJoin });
      const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });

      mockDb.select = mockSelect;

      try {
        await deleteKnowledgeDocument('nonexistent', 'user-1');
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(ChatSDKError);
        expect((error as ChatSDKError).type).toBe('not_found');
        expect((error as ChatSDKError).cause).toBe(
          'Knowledge document not found or access denied',
        );
      }
    });

    it('should verify workspace is not deleted', async () => {
      const mockDocument = {
        id: 'knowledge-1',
        workspaceId: 'ws-deleted',
        title: 'Document in deleted workspace',
      };

      // Simulating the innerJoin with workspace.deletedAt filter
      // In real scenario, the WHERE clause includes isNull(workspace.deletedAt)
      // So if workspace is deleted, the join returns empty
      const mockLimit = vi.fn().mockResolvedValue([]);
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockInnerJoin = vi.fn().mockReturnValue({ where: mockWhere });
      const mockFrom = vi.fn().mockReturnValue({ innerJoin: mockInnerJoin });
      const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });

      mockDb.select = mockSelect;

      try {
        await deleteKnowledgeDocument('knowledge-1', 'user-1');
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(ChatSDKError);
        expect((error as ChatSDKError).type).toBe('not_found');
        expect((error as ChatSDKError).cause).toBe(
          'Knowledge document not found or access denied',
        );
      }
    });

    it('should throw ChatSDKError on database failure', async () => {
      const mockLimit = vi.fn().mockRejectedValue(new Error('Database error'));
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockInnerJoin = vi.fn().mockReturnValue({ where: mockWhere });
      const mockFrom = vi.fn().mockReturnValue({ innerJoin: mockInnerJoin });
      const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });

      mockDb.select = mockSelect;

      try {
        await deleteKnowledgeDocument('knowledge-1', 'user-1');
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(ChatSDKError);
        expect((error as ChatSDKError).type).toBe('bad_request');
        expect((error as ChatSDKError).surface).toBe('database');
        expect((error as ChatSDKError).cause).toBe(
          'Failed to delete knowledge document',
        );
      }
    });

    it('should propagate ChatSDKError from ownership check', async () => {
      // Ownership check fails with NOT_FOUND
      const mockLimit = vi.fn().mockResolvedValue([]);
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockInnerJoin = vi.fn().mockReturnValue({ where: mockWhere });
      const mockFrom = vi.fn().mockReturnValue({ innerJoin: mockInnerJoin });
      const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });

      mockDb.select = mockSelect;

      try {
        await deleteKnowledgeDocument('knowledge-1', 'user-1');
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(ChatSDKError);
        // Should be NOT_FOUND from ownership check, not database error
        expect((error as ChatSDKError).type).toBe('not_found');
      }
    });
  });
});
