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
  },
}));

// Mock getDomain
vi.mock('@/lib/domains', () => ({
  getDomain: vi.fn((domainId) => ({
    id: domainId,
    name: 'Test Domain',
    defaultDocumentType: domainId === 'project' ? 'prd' : 'text',
  })),
}));

// Import after mocks
import {
  createObjective,
  getObjectivesByWorkspaceId,
  getObjectiveById,
  publishObjective,
  unpublishObjective,
  deleteObjective,
} from '../objective';
import { db } from '@/lib/db/queries';
import { ChatSDKError } from '@/lib/errors';

describe('Objective DAL Functions', () => {
  const mockDb = db as any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createObjective', () => {
    it('should create objective with inherited documentType from workspace domain', async () => {
      const mockWorkspace = {
        id: 'ws-1',
        userId: 'user-1',
        domainId: 'project',
        deletedAt: null,
      };

      const mockObjective = {
        id: 'obj-1',
        workspaceId: 'ws-1',
        title: 'Test Objective',
        description: 'Test description',
        documentType: 'prd',
        status: 'open',
        createdByUserId: 'user-1',
        objectiveDocumentId: null,
        publishedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Mock workspace query
      const mockLimit1 = vi.fn().mockResolvedValue([mockWorkspace]);
      const mockWhere1 = vi.fn().mockReturnValue({ limit: mockLimit1 });
      const mockFrom1 = vi.fn().mockReturnValue({ where: mockWhere1 });
      const mockSelect1 = vi.fn().mockReturnValue({ from: mockFrom1 });

      // Mock objective insert
      const mockReturning = vi.fn().mockResolvedValue([mockObjective]);
      const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
      const mockInsert = vi.fn().mockReturnValue({ values: mockValues });

      mockDb.select = mockSelect1;
      mockDb.insert = mockInsert;

      const result = await createObjective('ws-1', 'user-1', {
        title: 'Test Objective',
        description: 'Test description',
      });

      expect(result).toEqual(mockObjective);
      expect(result.documentType).toBe('prd'); // Inherited from 'project' domain
      expect(result.status).toBe('open');
      expect(mockSelect1).toHaveBeenCalled();
      expect(mockInsert).toHaveBeenCalled();
    });

    it('should create objective without description', async () => {
      const mockWorkspace = {
        id: 'ws-1',
        userId: 'user-1',
        domainId: 'general',
        deletedAt: null,
      };

      const mockObjective = {
        id: 'obj-2',
        workspaceId: 'ws-1',
        title: 'Minimal Objective',
        description: null,
        documentType: 'text',
        status: 'open',
        createdByUserId: 'user-1',
        objectiveDocumentId: null,
        publishedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockLimit = vi.fn().mockResolvedValue([mockWorkspace]);
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });

      const mockReturning = vi.fn().mockResolvedValue([mockObjective]);
      const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
      const mockInsert = vi.fn().mockReturnValue({ values: mockValues });

      mockDb.select = mockSelect;
      mockDb.insert = mockInsert;

      const result = await createObjective('ws-1', 'user-1', {
        title: 'Minimal Objective',
      });

      expect(result.title).toBe('Minimal Objective');
      expect(result.description).toBeNull();
    });

    it('should throw error when workspace not found', async () => {
      const mockLimit = vi.fn().mockResolvedValue([]);
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });

      mockDb.select = mockSelect;

      try {
        await createObjective('nonexistent-workspace', 'user-1', {
          title: 'Should Fail',
        });
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(ChatSDKError);
        expect((error as ChatSDKError).type).toBe('not_found');
        expect((error as ChatSDKError).cause).toBe(
          'Workspace not found or access denied',
        );
      }
    });

    it('should throw error when user does not own workspace', async () => {
      const mockLimit = vi.fn().mockResolvedValue([]);
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });

      mockDb.select = mockSelect;

      try {
        await createObjective('ws-1', 'wrong-user', {
          title: 'Unauthorized',
        });
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(ChatSDKError);
        expect((error as ChatSDKError).type).toBe('not_found');
        expect((error as ChatSDKError).cause).toBe(
          'Workspace not found or access denied',
        );
      }
    });
  });

  describe('getObjectivesByWorkspaceId', () => {
    it('should return only open objectives by default', async () => {
      const mockObjectives = [
        {
          id: 'obj-1',
          title: 'Open 1',
          status: 'open',
          workspaceId: 'ws-1',
        },
        {
          id: 'obj-2',
          title: 'Open 2',
          status: 'open',
          workspaceId: 'ws-1',
        },
      ];

      const mockOrderBy = vi.fn().mockResolvedValue(mockObjectives);
      const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });

      mockDb.select = mockSelect;

      const result = await getObjectivesByWorkspaceId('ws-1');

      expect(result).toEqual(mockObjectives);
      expect(mockSelect).toHaveBeenCalled();
      expect(mockWhere).toHaveBeenCalled();
      expect(mockOrderBy).toHaveBeenCalled();
    });

    it('should return all objectives when includePublished is true', async () => {
      const mockObjectives = [
        {
          id: 'obj-1',
          title: 'Open 1',
          status: 'open',
          workspaceId: 'ws-1',
        },
        {
          id: 'obj-2',
          title: 'Published',
          status: 'published',
          workspaceId: 'ws-1',
        },
      ];

      const mockOrderBy = vi.fn().mockResolvedValue(mockObjectives);
      const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });

      mockDb.select = mockSelect;

      const result = await getObjectivesByWorkspaceId('ws-1', true);

      expect(result.length).toBe(2);
      expect(result.some((o) => o.status === 'published')).toBe(true);
    });

    it('should return empty array for workspace with no objectives', async () => {
      const mockOrderBy = vi.fn().mockResolvedValue([]);
      const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });

      mockDb.select = mockSelect;

      const result = await getObjectivesByWorkspaceId('empty-ws');

      expect(result).toEqual([]);
    });
  });

  describe('getObjectiveById', () => {
    it('should return objective when user owns workspace', async () => {
      const mockResult = {
        objective: {
          id: 'obj-1',
          title: 'Get By ID Test',
          workspaceId: 'ws-1',
          status: 'open',
        },
      };

      const mockLimit = vi.fn().mockResolvedValue([mockResult]);
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockInnerJoin = vi.fn().mockReturnValue({ where: mockWhere });
      const mockFrom = vi.fn().mockReturnValue({ innerJoin: mockInnerJoin });
      const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });

      mockDb.select = mockSelect;

      const result = await getObjectiveById('obj-1', 'user-1');

      expect(result).toEqual(mockResult.objective);
      expect(result?.id).toBe('obj-1');
      expect(result?.title).toBe('Get By ID Test');
    });

    it('should return null when user does not own workspace', async () => {
      const mockLimit = vi.fn().mockResolvedValue([]);
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockInnerJoin = vi.fn().mockReturnValue({ where: mockWhere });
      const mockFrom = vi.fn().mockReturnValue({ innerJoin: mockInnerJoin });
      const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });

      mockDb.select = mockSelect;

      const result = await getObjectiveById('obj-1', 'wrong-user');

      expect(result).toBeNull();
    });

    it('should return null for nonexistent objective', async () => {
      const mockLimit = vi.fn().mockResolvedValue([]);
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockInnerJoin = vi.fn().mockReturnValue({ where: mockWhere });
      const mockFrom = vi.fn().mockReturnValue({ innerJoin: mockInnerJoin });
      const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });

      mockDb.select = mockSelect;

      const result = await getObjectiveById('nonexistent', 'user-1');

      expect(result).toBeNull();
    });
  });

  describe('publishObjective', () => {
    it('should set status to published and set publishedAt', async () => {
      const mockObjective = {
        id: 'obj-1',
        title: 'To Publish',
        status: 'open',
        publishedAt: null,
      };

      // Mock getObjectiveById call
      const mockLimit = vi
        .fn()
        .mockResolvedValue([{ objective: mockObjective }]);
      const mockWhere1 = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockInnerJoin = vi.fn().mockReturnValue({ where: mockWhere1 });
      const mockFrom = vi.fn().mockReturnValue({ innerJoin: mockInnerJoin });
      const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });

      // Mock update
      const mockWhere2 = vi.fn().mockResolvedValue(undefined);
      const mockSet = vi.fn().mockReturnValue({ where: mockWhere2 });
      const mockUpdate = vi.fn().mockReturnValue({ set: mockSet });

      mockDb.select = mockSelect;
      mockDb.update = mockUpdate;

      await publishObjective('obj-1', 'user-1');

      expect(mockUpdate).toHaveBeenCalled();
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'published',
          publishedAt: expect.any(Date),
        }),
      );
    });

    it('should throw error when user does not own workspace', async () => {
      // Mock getObjectiveById returning null (no access)
      const mockLimit = vi.fn().mockResolvedValue([]);
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockInnerJoin = vi.fn().mockReturnValue({ where: mockWhere });
      const mockFrom = vi.fn().mockReturnValue({ innerJoin: mockInnerJoin });
      const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });

      mockDb.select = mockSelect;

      try {
        await publishObjective('obj-1', 'wrong-user');
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(ChatSDKError);
        expect((error as ChatSDKError).type).toBe('not_found');
        expect((error as ChatSDKError).cause).toBe(
          'Objective not found or access denied',
        );
      }
    });

    it('should throw error for nonexistent objective', async () => {
      const mockLimit = vi.fn().mockResolvedValue([]);
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockInnerJoin = vi.fn().mockReturnValue({ where: mockWhere });
      const mockFrom = vi.fn().mockReturnValue({ innerJoin: mockInnerJoin });
      const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });

      mockDb.select = mockSelect;

      try {
        await publishObjective('nonexistent', 'user-1');
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(ChatSDKError);
        expect((error as ChatSDKError).type).toBe('not_found');
        expect((error as ChatSDKError).cause).toBe(
          'Objective not found or access denied',
        );
      }
    });
  });

  describe('unpublishObjective', () => {
    it('should set status back to open and clear publishedAt', async () => {
      const mockObjective = {
        id: 'obj-1',
        title: 'To Unpublish',
        status: 'published',
        publishedAt: new Date(),
      };

      // Mock getObjectiveById call
      const mockLimit = vi
        .fn()
        .mockResolvedValue([{ objective: mockObjective }]);
      const mockWhere1 = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockInnerJoin = vi.fn().mockReturnValue({ where: mockWhere1 });
      const mockFrom = vi.fn().mockReturnValue({ innerJoin: mockInnerJoin });
      const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });

      // Mock update
      const mockWhere2 = vi.fn().mockResolvedValue(undefined);
      const mockSet = vi.fn().mockReturnValue({ where: mockWhere2 });
      const mockUpdate = vi.fn().mockReturnValue({ set: mockSet });

      mockDb.select = mockSelect;
      mockDb.update = mockUpdate;

      await unpublishObjective('obj-1', 'user-1');

      expect(mockUpdate).toHaveBeenCalled();
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'open',
          publishedAt: null,
        }),
      );
    });

    it('should throw error when user does not own workspace', async () => {
      const mockLimit = vi.fn().mockResolvedValue([]);
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockInnerJoin = vi.fn().mockReturnValue({ where: mockWhere });
      const mockFrom = vi.fn().mockReturnValue({ innerJoin: mockInnerJoin });
      const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });

      mockDb.select = mockSelect;

      try {
        await unpublishObjective('obj-1', 'wrong-user');
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(ChatSDKError);
        expect((error as ChatSDKError).type).toBe('not_found');
        expect((error as ChatSDKError).cause).toBe(
          'Objective not found or access denied',
        );
      }
    });
  });

  describe('deleteObjective', () => {
    it('should delete objective successfully', async () => {
      const mockObjective = {
        id: 'obj-1',
        title: 'To Delete',
        status: 'open',
      };

      // Mock getObjectiveById call
      const mockLimit = vi
        .fn()
        .mockResolvedValue([{ objective: mockObjective }]);
      const mockWhere1 = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockInnerJoin = vi.fn().mockReturnValue({ where: mockWhere1 });
      const mockFrom = vi.fn().mockReturnValue({ innerJoin: mockInnerJoin });
      const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });

      // Mock delete
      const mockWhere2 = vi.fn().mockResolvedValue(undefined);
      const mockDelete = vi.fn().mockReturnValue({ where: mockWhere2 });

      mockDb.select = mockSelect;
      mockDb.delete = mockDelete;

      await deleteObjective('obj-1', 'user-1');

      expect(mockDelete).toHaveBeenCalled();
      expect(mockWhere2).toHaveBeenCalled();
    });

    it('should throw error when user does not own workspace', async () => {
      const mockLimit = vi.fn().mockResolvedValue([]);
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockInnerJoin = vi.fn().mockReturnValue({ where: mockWhere });
      const mockFrom = vi.fn().mockReturnValue({ innerJoin: mockInnerJoin });
      const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });

      mockDb.select = mockSelect;

      try {
        await deleteObjective('obj-1', 'wrong-user');
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(ChatSDKError);
        expect((error as ChatSDKError).type).toBe('not_found');
        expect((error as ChatSDKError).cause).toBe(
          'Objective not found or access denied',
        );
      }
    });

    it('should throw error for nonexistent objective', async () => {
      const mockLimit = vi.fn().mockResolvedValue([]);
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockInnerJoin = vi.fn().mockReturnValue({ where: mockWhere });
      const mockFrom = vi.fn().mockReturnValue({ innerJoin: mockInnerJoin });
      const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });

      mockDb.select = mockSelect;

      try {
        await deleteObjective('nonexistent', 'user-1');
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(ChatSDKError);
        expect((error as ChatSDKError).type).toBe('not_found');
        expect((error as ChatSDKError).cause).toBe(
          'Objective not found or access denied',
        );
      }
    });
  });
});
