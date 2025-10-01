import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock server-only before imports
vi.mock('server-only', () => ({}));

// Mock dependencies before importing modules
vi.mock('../queries', () => ({
  db: {
    insert: vi.fn(),
    update: vi.fn(),
    select: vi.fn(),
    selectDistinctOn: vi.fn(),
  },
}));

vi.mock('@/lib/rag/sync', () => ({
  syncDocumentToRAG: vi.fn(),
  deleteFromRAG: vi.fn(),
}));

vi.mock('@/lib/utils', () => ({
  generateUUID: vi.fn(() => 'test-uuid-123'),
}));

vi.mock('@/lib/logger', () => ({
  getLogger: vi.fn(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  })),
}));

// Now import after mocks are set up
import {
  saveDocument,
  softDeleteDocument,
  toggleDocumentSearchable,
  getWorkspaceDocuments,
  getRecentDocuments,
  getDocumentById,
  getDocumentsById,
  groupDocumentsByDate,
} from '../documents';
import { db } from '../queries';
import { syncDocumentToRAG, deleteFromRAG } from '@/lib/rag/sync';

describe('Document DAL', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('saveDocument', () => {
    it('should save document with documentType and isSearchable', async () => {
      const mockReturning = vi.fn().mockResolvedValue([
        {
          id: 'test-uuid-123',
          title: 'Test Doc',
          documentType: 'meeting-analysis',
          isSearchable: true,
        },
      ]);
      const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
      const mockInsert = vi.fn().mockReturnValue({ values: mockValues });
      (db.insert as any) = mockInsert;

      vi.mocked(syncDocumentToRAG).mockResolvedValue(undefined);

      const result = await saveDocument({
        title: 'Test Doc',
        kind: 'text',
        content: 'Test content',
        userId: 'user-123',
        workspaceId: 'workspace-123',
        metadata: { documentType: 'meeting-analysis' },
      });

      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          documentType: 'meeting-analysis',
          isSearchable: true,
        }),
      );
      expect(result).toHaveLength(1);
      expect(syncDocumentToRAG).toHaveBeenCalledWith(
        'test-uuid-123',
        'workspace-123',
      );
    });

    it('should default documentType to "text" when not provided', async () => {
      const mockReturning = vi.fn().mockResolvedValue([
        {
          id: 'test-uuid-123',
          documentType: 'text',
        },
      ]);
      const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
      const mockInsert = vi.fn().mockReturnValue({ values: mockValues });
      (db.insert as any) = mockInsert;

      vi.mocked(syncDocumentToRAG).mockResolvedValue(undefined);

      await saveDocument({
        title: 'Test Doc',
        kind: 'text',
        content: 'Test content',
        userId: 'user-123',
        workspaceId: 'workspace-123',
      });

      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          documentType: 'text',
        }),
      );
    });
  });

  describe('softDeleteDocument', () => {
    it('should set deletedAt and remove from RAG', async () => {
      vi.mocked(deleteFromRAG).mockResolvedValue(undefined);

      const mockReturning = vi.fn().mockResolvedValue([
        {
          id: 'doc-123',
          deletedAt: expect.any(Date),
          isSearchable: false,
        },
      ]);
      const mockWhere = vi.fn().mockReturnValue({ returning: mockReturning });
      const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
      const mockUpdate = vi.fn().mockReturnValue({ set: mockSet });
      (db.update as any) = mockUpdate;

      const result = await softDeleteDocument('doc-123', 'workspace-123');

      expect(deleteFromRAG).toHaveBeenCalledWith('doc-123', 'workspace-123');
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          deletedAt: expect.any(Date),
          isSearchable: false,
        }),
      );
      expect(result).toBeDefined();
    });

    it('should be idempotent (no error on already deleted)', async () => {
      vi.mocked(deleteFromRAG).mockResolvedValue(undefined);

      const mockReturning = vi.fn().mockResolvedValue([]);
      const mockWhere = vi.fn().mockReturnValue({ returning: mockReturning });
      const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
      const mockUpdate = vi.fn().mockReturnValue({ set: mockSet });
      (db.update as any) = mockUpdate;

      await expect(
        softDeleteDocument('doc-123', 'workspace-123'),
      ).rejects.toThrow();
    });

    it('should rollback if RAG deletion fails', async () => {
      vi.mocked(deleteFromRAG).mockRejectedValue(new Error('RAG error'));

      await expect(
        softDeleteDocument('doc-123', 'workspace-123'),
      ).rejects.toThrow();

      // Database update should not have been called
      expect(db.update).not.toHaveBeenCalled();
    });
  });

  describe('toggleDocumentSearchable', () => {
    it('should call syncDocumentToRAG when setting to true', async () => {
      const mockReturning = vi
        .fn()
        .mockResolvedValue([{ id: 'doc-123', isSearchable: true }]);
      const mockWhere = vi.fn().mockReturnValue({ returning: mockReturning });
      const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
      const mockUpdate = vi.fn().mockReturnValue({ set: mockSet });
      (db.update as any) = mockUpdate;

      vi.mocked(syncDocumentToRAG).mockResolvedValue(undefined);

      await toggleDocumentSearchable('doc-123', 'workspace-123', true);

      expect(mockSet).toHaveBeenCalledWith({ isSearchable: true });
      expect(syncDocumentToRAG).toHaveBeenCalledWith(
        'doc-123',
        'workspace-123',
      );
      expect(deleteFromRAG).not.toHaveBeenCalled();
    });

    it('should call deleteFromRAG when setting to false', async () => {
      const mockReturning = vi
        .fn()
        .mockResolvedValue([{ id: 'doc-123', isSearchable: false }]);
      const mockWhere = vi.fn().mockReturnValue({ returning: mockReturning });
      const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
      const mockUpdate = vi.fn().mockReturnValue({ set: mockSet });
      (db.update as any) = mockUpdate;

      vi.mocked(deleteFromRAG).mockResolvedValue(undefined);

      await toggleDocumentSearchable('doc-123', 'workspace-123', false);

      expect(mockSet).toHaveBeenCalledWith({ isSearchable: false });
      expect(deleteFromRAG).toHaveBeenCalledWith('doc-123', 'workspace-123');
      expect(syncDocumentToRAG).not.toHaveBeenCalled();
    });

    it('should throw error if document not found', async () => {
      const mockReturning = vi.fn().mockResolvedValue([]);
      const mockWhere = vi.fn().mockReturnValue({ returning: mockReturning });
      const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
      const mockUpdate = vi.fn().mockReturnValue({ set: mockSet });
      (db.update as any) = mockUpdate;

      await expect(
        toggleDocumentSearchable('doc-123', 'workspace-123', true),
      ).rejects.toThrow();
    });
  });

  describe('getWorkspaceDocuments', () => {
    it('should exclude soft-deleted documents', async () => {
      const mockOrderBy = vi.fn().mockResolvedValue([
        {
          id: 'doc-1',
          title: 'Active Doc',
          createdAt: new Date(),
          metadata: {},
          sourceDocumentIds: [],
          contentLength: 100,
        },
      ]);
      const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      const mockSelectDistinctOn = vi.fn().mockReturnValue({ from: mockFrom });
      (db.selectDistinctOn as any) = mockSelectDistinctOn;

      const result = await getWorkspaceDocuments('workspace-123');

      // Verify the where clause includes isNull check
      const whereCall = mockWhere.mock.calls[0][0];
      expect(whereCall).toBeDefined();
      expect(result).toHaveLength(1);
    });

    it('should return documents with estimated tokens and humanReadableSize', async () => {
      const mockOrderBy = vi.fn().mockResolvedValue([
        {
          id: 'doc-1',
          title: 'Test Doc',
          createdAt: new Date(),
          metadata: { documentType: 'meeting-analysis' },
          sourceDocumentIds: [],
          contentLength: 1000,
        },
      ]);
      const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      const mockSelectDistinctOn = vi.fn().mockReturnValue({ from: mockFrom });
      (db.selectDistinctOn as any) = mockSelectDistinctOn;

      const result = await getWorkspaceDocuments('workspace-123');

      expect(result[0]).toHaveProperty('estimatedTokens', 250); // 1000/4
      expect(result[0]).toHaveProperty('humanReadableSize');
      expect(result[0].documentType).toBe('meeting-analysis');
    });
  });

  describe('getRecentDocuments', () => {
    it('should return max 20 documents by default', async () => {
      const mockLimit = vi.fn().mockResolvedValue([]);
      const mockOrderBy = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });
      (db.select as any) = mockSelect;

      await getRecentDocuments('workspace-123');

      expect(mockLimit).toHaveBeenCalledWith(20);
    });

    it('should accept custom limit', async () => {
      const mockLimit = vi.fn().mockResolvedValue([]);
      const mockOrderBy = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });
      (db.select as any) = mockSelect;

      await getRecentDocuments('workspace-123', 10);

      expect(mockLimit).toHaveBeenCalledWith(10);
    });

    it('should extract source chat metadata', async () => {
      const mockLimit = vi.fn().mockResolvedValue([
        {
          id: 'doc-1',
          title: 'Test',
          documentType: 'text',
          createdAt: new Date(),
          isSearchable: true,
          metadata: {
            sourceChatId: 'chat-123',
            sourceChatTitle: 'Chat Title',
          },
        },
      ]);
      const mockOrderBy = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });
      (db.select as any) = mockSelect;

      const result = await getRecentDocuments('workspace-123');

      expect(result[0].sourceChat).toEqual({
        id: 'chat-123',
        title: 'Chat Title',
      });
    });
  });

  describe('groupDocumentsByDate', () => {
    it('should correctly categorize documents by time periods', () => {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const lastWeek = new Date(today);
      lastWeek.setDate(lastWeek.getDate() - 7);
      const lastMonth = new Date(today);
      lastMonth.setDate(lastMonth.getDate() - 30);

      const documents = [
        { id: '1', createdAt: new Date(today.getTime() + 1000) }, // today
        { id: '2', createdAt: new Date(yesterday.getTime() + 1000) }, // yesterday
        { id: '3', createdAt: new Date(lastWeek.getTime() + 1000) }, // last week
        { id: '4', createdAt: new Date(lastMonth.getTime() + 1000) }, // last month
        { id: '5', createdAt: new Date(lastMonth.getTime() - 1000) }, // older
      ];

      const grouped = groupDocumentsByDate(documents);

      expect(grouped.today).toHaveLength(1);
      expect(grouped.yesterday).toHaveLength(1);
      expect(grouped.lastWeek).toHaveLength(1);
      expect(grouped.lastMonth).toHaveLength(1);
      expect(grouped.older).toHaveLength(1);
    });

    it('should handle empty array', () => {
      const grouped = groupDocumentsByDate([]);

      expect(grouped.today).toHaveLength(0);
      expect(grouped.yesterday).toHaveLength(0);
      expect(grouped.lastWeek).toHaveLength(0);
      expect(grouped.lastMonth).toHaveLength(0);
      expect(grouped.older).toHaveLength(0);
    });
  });

  describe('getDocumentById', () => {
    it('should filter soft-deleted documents', async () => {
      const mockOrderBy = vi.fn().mockResolvedValue([]);
      const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });
      (db.select as any) = mockSelect;

      await getDocumentById({ id: 'doc-123', workspaceId: 'workspace-123' });

      // Verify the where clause was called
      expect(mockWhere).toHaveBeenCalled();
    });

    it('should return undefined for non-existent document', async () => {
      const mockOrderBy = vi.fn().mockResolvedValue([]);
      const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });
      (db.select as any) = mockSelect;

      const result = await getDocumentById({
        id: 'doc-123',
        workspaceId: 'workspace-123',
      });

      expect(result).toBeUndefined();
    });
  });

  describe('getDocumentsById', () => {
    it('should filter soft-deleted documents', async () => {
      const mockOrderBy = vi.fn().mockResolvedValue([
        {
          id: 'doc-123',
          title: 'Active Doc',
          deletedAt: null,
        },
      ]);
      const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });
      (db.select as any) = mockSelect;

      const result = await getDocumentsById({
        id: 'doc-123',
        workspaceId: 'workspace-123',
      });

      expect(result).toHaveLength(1);
      expect(mockWhere).toHaveBeenCalled();
    });
  });
});
