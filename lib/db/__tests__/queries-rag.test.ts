import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { saveDocument, updateDocument, deleteDocument } from '../queries';
import { syncDocumentToRAG, deleteFromRAG } from '@/lib/rag/sync';

// Mock the database and RAG sync
vi.mock('../index', () => ({
  db: {
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    select: vi.fn(),
  },
}));

vi.mock('@/lib/rag/sync', () => ({
  syncDocumentToRAG: vi.fn().mockResolvedValue(undefined),
  deleteFromRAG: vi.fn().mockResolvedValue(undefined),
}));

// Mock the schema imports
vi.mock('../schema', () => ({
  document: {
    id: 'id',
    title: 'title',
    content: 'content',
    kind: 'kind',
    userId: 'userId',
    createdAt: 'createdAt',
    metadata: 'metadata',
    sourceDocumentIds: 'sourceDocumentIds',
  },
  suggestion: {
    documentId: 'documentId',
  },
}));

describe('Database Queries - RAG Sync Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default mock returns for database operations
    const mockInsert = {
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([
        {
          id: 'doc-123',
          title: 'Test Document',
          content: 'Test content',
        },
      ]),
    };

    const mockUpdate = {
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([
        {
          id: 'doc-123',
          title: 'Updated Document',
        },
      ]),
    };

    const mockDelete = {
      where: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([
        {
          id: 'doc-123',
        },
      ]),
    };

    vi.mocked(db.insert).mockReturnValue(mockInsert as any);
    vi.mocked(db.update).mockReturnValue(mockUpdate as any);
    vi.mocked(db.delete).mockReturnValue(mockDelete as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('saveDocument', () => {
    it('should trigger RAG sync after successful save', async () => {
      const documentData = {
        title: 'Test Document',
        kind: 'text' as const,
        content: 'Test content',
        userId: 'user-123',
        metadata: { documentType: 'transcript' },
        sourceDocumentIds: ['doc-1', 'doc-2'],
      };

      await saveDocument(documentData);

      // Verify document was saved
      expect(db.insert).toHaveBeenCalled();

      // Verify RAG sync was triggered with the document ID
      expect(syncDocumentToRAG).toHaveBeenCalledWith(
        expect.stringMatching(/^[a-f0-9-]+$/),
      );
    });

    it('should not throw if RAG sync fails', async () => {
      // Make RAG sync reject
      vi.mocked(syncDocumentToRAG).mockRejectedValue(
        new Error('RAG sync failed'),
      );

      const documentData = {
        title: 'Test Document',
        kind: 'text' as const,
        content: 'Test content',
        userId: 'user-123',
      };

      // Should not throw
      const result = await saveDocument(documentData);
      expect(result).toBeDefined();
      expect(result[0].id).toBe('doc-123');
    });

    it('should handle document with explicit ID', async () => {
      const documentData = {
        id: 'custom-id-456',
        title: 'Test Document',
        kind: 'text' as const,
        content: 'Test content',
        userId: 'user-123',
      };

      await saveDocument(documentData);

      // Verify RAG sync was called with the custom ID
      expect(syncDocumentToRAG).toHaveBeenCalledWith('custom-id-456');
    });
  });

  describe('updateDocument', () => {
    it('should trigger RAG sync after successful update', async () => {
      const updates = {
        title: 'Updated Title',
        content: 'Updated content',
      };

      await updateDocument('doc-123', updates);

      // Verify document was updated
      expect(db.update).toHaveBeenCalled();

      // Verify RAG sync was triggered
      expect(syncDocumentToRAG).toHaveBeenCalledWith('doc-123');
    });

    it('should not throw if RAG sync fails during update', async () => {
      vi.mocked(syncDocumentToRAG).mockRejectedValue(
        new Error('RAG sync failed'),
      );

      const updates = {
        content: 'New content',
      };

      // Should not throw
      const result = await updateDocument('doc-123', updates);
      expect(result).toBeDefined();
      expect(result.id).toBe('doc-123');
    });

    it('should handle partial updates', async () => {
      const updates = {
        metadata: { documentType: 'meeting-summary' },
      };

      await updateDocument('doc-123', updates);

      // RAG sync should still be triggered for metadata updates
      expect(syncDocumentToRAG).toHaveBeenCalledWith('doc-123');
    });
  });

  describe('deleteDocument', () => {
    it('should delete from RAG before deleting from database', async () => {
      await deleteDocument('doc-123');

      // Verify RAG deletion was called
      expect(deleteFromRAG).toHaveBeenCalledWith('doc-123');

      // Verify database deletion was called
      expect(db.delete).toHaveBeenCalled();

      // Verify order: RAG delete should be called before DB delete
      const ragSyncOrder = vi.mocked(deleteFromRAG).mock.invocationCallOrder[0];
      const dbDeleteOrder = vi.mocked(db.delete).mock.invocationCallOrder[0];
      expect(ragSyncOrder).toBeLessThan(dbDeleteOrder);
    });

    it('should await RAG deletion before database deletion', async () => {
      let ragDeleteComplete = false;
      let dbDeleteStarted = false;

      vi.mocked(deleteFromRAG).mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        ragDeleteComplete = true;
      });

      vi.mocked(db.delete).mockImplementation(() => {
        dbDeleteStarted = true;
        // At this point, RAG delete should be complete
        expect(ragDeleteComplete).toBe(true);
        return {
          where: vi.fn().mockReturnThis(),
          returning: vi.fn().mockResolvedValue([{ id: 'doc-123' }]),
        } as any;
      });

      await deleteDocument('doc-123');

      expect(dbDeleteStarted).toBe(true);
    });

    it('should still delete from database if RAG deletion fails', async () => {
      vi.mocked(deleteFromRAG).mockRejectedValue(
        new Error('RAG delete failed'),
      );

      // Should not throw and should still delete from DB
      const result = await deleteDocument('doc-123');

      expect(db.delete).toHaveBeenCalled();
      expect(result).toBeDefined();
    });
  });

  describe('Non-blocking RAG sync', () => {
    it('should not wait for RAG sync on create', async () => {
      let ragSyncComplete = false;

      vi.mocked(syncDocumentToRAG).mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        ragSyncComplete = true;
      });

      const startTime = Date.now();
      await saveDocument({
        title: 'Test',
        kind: 'text' as const,
        content: 'Content',
        userId: 'user-123',
      });
      const endTime = Date.now();

      // Should return quickly without waiting for RAG sync
      expect(endTime - startTime).toBeLessThan(50);
      expect(ragSyncComplete).toBe(false);

      // Wait for RAG sync to complete
      await new Promise((resolve) => setTimeout(resolve, 150));
      expect(ragSyncComplete).toBe(true);
    });

    it('should not wait for RAG sync on update', async () => {
      let ragSyncComplete = false;

      vi.mocked(syncDocumentToRAG).mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        ragSyncComplete = true;
      });

      const startTime = Date.now();
      await updateDocument('doc-123', { content: 'New content' });
      const endTime = Date.now();

      // Should return quickly without waiting for RAG sync
      expect(endTime - startTime).toBeLessThan(50);
      expect(ragSyncComplete).toBe(false);

      // Wait for RAG sync to complete
      await new Promise((resolve) => setTimeout(resolve, 150));
      expect(ragSyncComplete).toBe(true);
    });

    it('should handle multiple concurrent operations', async () => {
      const operations = [
        saveDocument({
          title: 'Doc 1',
          kind: 'text' as const,
          content: 'Content 1',
          userId: 'user-123',
        }),
        saveDocument({
          title: 'Doc 2',
          kind: 'text' as const,
          content: 'Content 2',
          userId: 'user-123',
        }),
        updateDocument('doc-existing', { content: 'Updated' }),
      ];

      // All operations should complete quickly
      await Promise.all(operations);

      // RAG sync should have been triggered for all
      expect(syncDocumentToRAG).toHaveBeenCalledTimes(2);
      expect(syncDocumentToRAG).toHaveBeenCalledTimes(1);
    });
  });
});
