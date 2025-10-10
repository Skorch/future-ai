import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createObjectiveAction,
  deleteObjectiveAction,
  updateObjectiveAction,
  publishObjectiveAction,
  unpublishObjectiveAction,
  toggleObjectivePublishAction,
} from '@/lib/objective/actions';
import * as objectiveDAL from '@/lib/db/objective';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

// Mock dependencies
vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  redirect: vi.fn(() => {
    throw new Error('NEXT_REDIRECT');
  }),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  getLogger: vi.fn(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

vi.mock('@/lib/db/objective', () => ({
  createObjective: vi.fn(),
  deleteObjective: vi.fn(),
  updateObjective: vi.fn(),
  publishObjective: vi.fn(),
  unpublishObjective: vi.fn(),
  getObjectiveById: vi.fn(),
}));

describe('Objective Server Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createObjectiveAction', () => {
    it('should create objective and return success with id', async () => {
      const mockObjective = {
        id: 'obj-123',
        workspaceId: 'ws-1',
        title: 'Test Objective',
        description: 'Test description',
        documentType: 'prd',
        status: 'open' as const,
        createdByUserId: 'user-1',
        objectiveDocumentId: null,
        publishedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(auth).mockResolvedValue({ userId: 'user-1' } as never);
      vi.mocked(objectiveDAL.createObjective).mockResolvedValue(mockObjective);

      const result = await createObjectiveAction('ws-1', {
        title: 'Test Objective',
        description: 'Test description',
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ id: 'obj-123' });
      expect(result.revalidate).toEqual({
        paths: ['/workspace/ws-1'],
        swrKeys: ['/api/workspace/ws-1/objectives'],
      });
      expect(objectiveDAL.createObjective).toHaveBeenCalledWith(
        'ws-1',
        'user-1',
        {
          title: 'Test Objective',
          description: 'Test description',
        },
      );
    });

    it('should create objective without description', async () => {
      const mockObjective = {
        id: 'obj-456',
        workspaceId: 'ws-2',
        title: 'Minimal',
        description: null,
        documentType: 'text',
        status: 'open' as const,
        createdByUserId: 'user-2',
        objectiveDocumentId: null,
        publishedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(auth).mockResolvedValue({ userId: 'user-2' } as never);
      vi.mocked(objectiveDAL.createObjective).mockResolvedValue(mockObjective);

      const result = await createObjectiveAction('ws-2', {
        title: 'Minimal',
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ id: 'obj-456' });
    });

    it('should redirect when user is not authenticated', async () => {
      vi.mocked(auth).mockResolvedValue({ userId: null } as never);

      await expect(
        createObjectiveAction('ws-1', { title: 'Test' }),
      ).rejects.toThrow('NEXT_REDIRECT');
      expect(redirect).toHaveBeenCalledWith('/login');
      expect(objectiveDAL.createObjective).not.toHaveBeenCalled();
    });

    it('should return error when DAL throws', async () => {
      vi.mocked(auth).mockResolvedValue({ userId: 'user-1' } as never);
      vi.mocked(objectiveDAL.createObjective).mockRejectedValue(
        new Error('Database error'),
      );

      const result = await createObjectiveAction('ws-1', { title: 'Test' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database error');
    });
  });

  describe('deleteObjectiveAction', () => {
    it('should delete objective and return success', async () => {
      const mockObjective = {
        id: 'obj-123',
        workspaceId: 'ws-1',
        title: 'To Delete',
        description: null,
        documentType: 'text',
        status: 'open' as const,
        createdByUserId: 'user-1',
        objectiveDocumentId: null,
        publishedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(auth).mockResolvedValue({ userId: 'user-1' } as never);
      vi.mocked(objectiveDAL.getObjectiveById).mockResolvedValue(mockObjective);
      vi.mocked(objectiveDAL.deleteObjective).mockResolvedValue(undefined);

      const result = await deleteObjectiveAction('obj-123');

      expect(result.success).toBe(true);
      expect(result.revalidate).toEqual({
        paths: ['/workspace/ws-1'],
        swrKeys: ['/api/workspace/ws-1/objectives'],
      });
      expect(objectiveDAL.deleteObjective).toHaveBeenCalledWith(
        'obj-123',
        'user-1',
      );
    });

    it('should return error when objective not found', async () => {
      vi.mocked(auth).mockResolvedValue({ userId: 'user-1' } as never);
      vi.mocked(objectiveDAL.getObjectiveById).mockResolvedValue(null);

      const result = await deleteObjectiveAction('nonexistent');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Objective not found');
      expect(objectiveDAL.deleteObjective).not.toHaveBeenCalled();
    });

    it('should redirect when user is not authenticated', async () => {
      vi.mocked(auth).mockResolvedValue({ userId: null } as never);

      await expect(deleteObjectiveAction('obj-123')).rejects.toThrow(
        'NEXT_REDIRECT',
      );
      expect(redirect).toHaveBeenCalledWith('/login');
    });
  });

  describe('updateObjectiveAction', () => {
    it('should update objective title and description', async () => {
      const mockObjective = {
        id: 'obj-123',
        workspaceId: 'ws-1',
        title: 'Original',
        description: 'Original desc',
        documentType: 'text',
        status: 'open' as const,
        createdByUserId: 'user-1',
        objectiveDocumentId: null,
        publishedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(auth).mockResolvedValue({ userId: 'user-1' } as never);
      vi.mocked(objectiveDAL.getObjectiveById).mockResolvedValue(mockObjective);
      vi.mocked(objectiveDAL.updateObjective).mockResolvedValue({
        ...mockObjective,
        title: 'Updated',
        description: 'Updated desc',
      });

      const result = await updateObjectiveAction('obj-123', {
        title: 'Updated',
        description: 'Updated desc',
      });

      expect(result.success).toBe(true);
      expect(result.revalidate).toEqual({
        paths: ['/workspace/ws-1', '/workspace/ws-1/objective/obj-123'],
        swrKeys: ['/api/workspace/ws-1/objectives'],
      });
      expect(objectiveDAL.updateObjective).toHaveBeenCalledWith(
        'obj-123',
        'user-1',
        {
          title: 'Updated',
          description: 'Updated desc',
        },
      );
    });

    it('should handle partial update (title only)', async () => {
      const mockObjective = {
        id: 'obj-123',
        workspaceId: 'ws-1',
        title: 'Original',
        description: 'Keep this',
        documentType: 'text',
        status: 'open' as const,
        createdByUserId: 'user-1',
        objectiveDocumentId: null,
        publishedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(auth).mockResolvedValue({ userId: 'user-1' } as never);
      vi.mocked(objectiveDAL.getObjectiveById).mockResolvedValue(mockObjective);
      vi.mocked(objectiveDAL.updateObjective).mockResolvedValue({
        ...mockObjective,
        title: 'New Title',
      });

      const result = await updateObjectiveAction('obj-123', {
        title: 'New Title',
      });

      expect(result.success).toBe(true);
      expect(objectiveDAL.updateObjective).toHaveBeenCalledWith(
        'obj-123',
        'user-1',
        { title: 'New Title' },
      );
    });

    it('should return error when objective not found', async () => {
      vi.mocked(auth).mockResolvedValue({ userId: 'user-1' } as never);
      vi.mocked(objectiveDAL.getObjectiveById).mockResolvedValue(null);

      const result = await updateObjectiveAction('nonexistent', {
        title: 'Test',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Objective not found');
      expect(objectiveDAL.updateObjective).not.toHaveBeenCalled();
    });

    it('should redirect when user is not authenticated', async () => {
      vi.mocked(auth).mockResolvedValue({ userId: null } as never);

      await expect(
        updateObjectiveAction('obj-123', { title: 'Test' }),
      ).rejects.toThrow('NEXT_REDIRECT');
      expect(redirect).toHaveBeenCalledWith('/login');
    });
  });

  describe('publishObjectiveAction', () => {
    it('should publish objective and set publishedAt', async () => {
      const mockObjective = {
        id: 'obj-123',
        workspaceId: 'ws-1',
        title: 'To Publish',
        description: null,
        documentType: 'text',
        status: 'open' as const,
        createdByUserId: 'user-1',
        objectiveDocumentId: null,
        publishedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(auth).mockResolvedValue({ userId: 'user-1' } as never);
      vi.mocked(objectiveDAL.getObjectiveById).mockResolvedValue(mockObjective);
      vi.mocked(objectiveDAL.publishObjective).mockResolvedValue(undefined);

      const result = await publishObjectiveAction('obj-123');

      expect(result.success).toBe(true);
      expect(result.revalidate).toEqual({
        paths: ['/workspace/ws-1', '/workspace/ws-1/objective/obj-123'],
        swrKeys: ['/api/workspace/ws-1/objectives'],
      });
      expect(objectiveDAL.publishObjective).toHaveBeenCalledWith(
        'obj-123',
        'user-1',
      );
    });

    it('should return error when objective not found', async () => {
      vi.mocked(auth).mockResolvedValue({ userId: 'user-1' } as never);
      vi.mocked(objectiveDAL.getObjectiveById).mockResolvedValue(null);

      const result = await publishObjectiveAction('nonexistent');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Objective not found');
      expect(objectiveDAL.publishObjective).not.toHaveBeenCalled();
    });

    it('should redirect when user is not authenticated', async () => {
      vi.mocked(auth).mockResolvedValue({ userId: null } as never);

      await expect(publishObjectiveAction('obj-123')).rejects.toThrow(
        'NEXT_REDIRECT',
      );
      expect(redirect).toHaveBeenCalledWith('/login');
    });
  });

  describe('unpublishObjectiveAction', () => {
    it('should unpublish objective and clear publishedAt', async () => {
      const mockObjective = {
        id: 'obj-123',
        workspaceId: 'ws-1',
        title: 'To Unpublish',
        description: null,
        documentType: 'text',
        status: 'published' as const,
        createdByUserId: 'user-1',
        objectiveDocumentId: null,
        publishedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(auth).mockResolvedValue({ userId: 'user-1' } as never);
      vi.mocked(objectiveDAL.getObjectiveById).mockResolvedValue(mockObjective);
      vi.mocked(objectiveDAL.unpublishObjective).mockResolvedValue(undefined);

      const result = await unpublishObjectiveAction('obj-123');

      expect(result.success).toBe(true);
      expect(result.revalidate).toEqual({
        paths: ['/workspace/ws-1', '/workspace/ws-1/objective/obj-123'],
        swrKeys: ['/api/workspace/ws-1/objectives'],
      });
      expect(objectiveDAL.unpublishObjective).toHaveBeenCalledWith(
        'obj-123',
        'user-1',
      );
    });

    it('should return error when objective not found', async () => {
      vi.mocked(auth).mockResolvedValue({ userId: 'user-1' } as never);
      vi.mocked(objectiveDAL.getObjectiveById).mockResolvedValue(null);

      const result = await unpublishObjectiveAction('nonexistent');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Objective not found');
      expect(objectiveDAL.unpublishObjective).not.toHaveBeenCalled();
    });

    it('should redirect when user is not authenticated', async () => {
      vi.mocked(auth).mockResolvedValue({ userId: null } as never);

      await expect(unpublishObjectiveAction('obj-123')).rejects.toThrow(
        'NEXT_REDIRECT',
      );
      expect(redirect).toHaveBeenCalledWith('/login');
    });
  });

  describe('toggleObjectivePublishAction', () => {
    it('should call publishObjectiveAction when published is true', async () => {
      const mockObjective = {
        id: 'obj-123',
        workspaceId: 'ws-1',
        title: 'To Toggle',
        description: null,
        documentType: 'text',
        status: 'open' as const,
        createdByUserId: 'user-1',
        objectiveDocumentId: null,
        publishedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(auth).mockResolvedValue({ userId: 'user-1' } as never);
      vi.mocked(objectiveDAL.getObjectiveById).mockResolvedValue(mockObjective);
      vi.mocked(objectiveDAL.publishObjective).mockResolvedValue(undefined);

      const result = await toggleObjectivePublishAction('obj-123', true);

      expect(result.success).toBe(true);
      expect(objectiveDAL.publishObjective).toHaveBeenCalledWith(
        'obj-123',
        'user-1',
      );
      expect(objectiveDAL.unpublishObjective).not.toHaveBeenCalled();
    });

    it('should call unpublishObjectiveAction when published is false', async () => {
      const mockObjective = {
        id: 'obj-123',
        workspaceId: 'ws-1',
        title: 'To Toggle',
        description: null,
        documentType: 'text',
        status: 'published' as const,
        createdByUserId: 'user-1',
        objectiveDocumentId: null,
        publishedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(auth).mockResolvedValue({ userId: 'user-1' } as never);
      vi.mocked(objectiveDAL.getObjectiveById).mockResolvedValue(mockObjective);
      vi.mocked(objectiveDAL.unpublishObjective).mockResolvedValue(undefined);

      const result = await toggleObjectivePublishAction('obj-123', false);

      expect(result.success).toBe(true);
      expect(objectiveDAL.unpublishObjective).toHaveBeenCalledWith(
        'obj-123',
        'user-1',
      );
      expect(objectiveDAL.publishObjective).not.toHaveBeenCalled();
    });

    it('should redirect when user is not authenticated', async () => {
      vi.mocked(auth).mockResolvedValue({ userId: null } as never);

      await expect(
        toggleObjectivePublishAction('obj-123', true),
      ).rejects.toThrow('NEXT_REDIRECT');
      expect(redirect).toHaveBeenCalledWith('/login');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle DAL throwing ChatSDKError', async () => {
      const { ChatSDKError } = await import('@/lib/errors');

      vi.mocked(auth).mockResolvedValue({ userId: 'user-1' } as never);
      vi.mocked(objectiveDAL.createObjective).mockRejectedValue(
        new ChatSDKError('not_found:database', 'Workspace not found'),
      );

      const result = await createObjectiveAction('ws-nonexistent', {
        title: 'Test',
      });

      expect(result.success).toBe(false);
      // ChatSDKError with database surface returns generic message
      expect(result.error).toBe(
        'An error occurred while executing a database query.',
      );
    });

    it('should handle concurrent operations gracefully', async () => {
      const mockObjective = {
        id: 'obj-123',
        workspaceId: 'ws-1',
        title: 'Concurrent Test',
        description: null,
        documentType: 'text',
        status: 'open' as const,
        createdByUserId: 'user-1',
        objectiveDocumentId: null,
        publishedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(auth).mockResolvedValue({ userId: 'user-1' } as never);
      vi.mocked(objectiveDAL.getObjectiveById).mockResolvedValue(mockObjective);
      vi.mocked(objectiveDAL.updateObjective).mockResolvedValue(mockObjective);

      // Fire off multiple updates
      const promises = [
        updateObjectiveAction('obj-123', { title: 'Update 1' }),
        updateObjectiveAction('obj-123', { title: 'Update 2' }),
        updateObjectiveAction('obj-123', { description: 'Update 3' }),
      ];

      const results = await Promise.all(promises);

      expect(results.every((r) => r.success)).toBe(true);
      expect(objectiveDAL.updateObjective).toHaveBeenCalledTimes(3);
    });
  });
});
