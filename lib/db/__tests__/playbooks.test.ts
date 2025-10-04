import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies FIRST
vi.mock('server-only', () => ({}));

// Mock next/cache
vi.mock('next/cache', () => ({
  unstable_cache: vi.fn((fn) => fn),
  revalidateTag: vi.fn(),
}));

// Mock database - must be created inside factory
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
  getAllPlaybooks,
  getPlaybooksForDomain,
  getPlaybookWithSteps,
  createPlaybook,
  updatePlaybook,
  deletePlaybook,
  listPlaybooks,
} from '../queries/playbooks';
import { revalidateTag } from 'next/cache';
import { db } from '@/lib/db/queries';

describe('Playbook DAL Functions', () => {
  const mockDb = db as any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getAllPlaybooks', () => {
    it('should fetch all playbooks with metadata', async () => {
      const mockPlaybooks = [
        {
          id: 'pb-1',
          name: 'bant-validation',
          description: 'BANT validation playbook',
          whenToUse: 'Use for sales calls',
          domains: ['sales'],
        },
        {
          id: 'pb-2',
          name: 'initiative-validation',
          description: 'Initiative validation playbook',
          whenToUse: 'Use for project meetings',
          domains: ['meeting'],
        },
      ];

      const mockOrderBy = vi.fn().mockResolvedValue(mockPlaybooks);
      const mockFrom = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });
      mockDb.select = mockSelect;

      const result = await getAllPlaybooks();

      expect(result).toEqual(mockPlaybooks);
      expect(mockSelect).toHaveBeenCalled();
      expect(mockFrom).toHaveBeenCalled();
      expect(mockOrderBy).toHaveBeenCalled();
    });

    it('should return empty array when no playbooks exist', async () => {
      const mockOrderBy = vi.fn().mockResolvedValue([]);
      const mockFrom = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });
      mockDb.select = mockSelect;

      const result = await getAllPlaybooks();

      expect(result).toEqual([]);
    });
  });

  describe('getPlaybooksForDomain', () => {
    it('should filter playbooks by domain', async () => {
      const mockPlaybooks = [
        {
          id: 'pb-1',
          name: 'bant-validation',
          description: 'BANT validation',
          whenToUse: 'Sales calls',
          domains: ['sales'],
        },
        {
          id: 'pb-2',
          name: 'initiative-validation',
          description: 'Initiative validation',
          whenToUse: 'Project meetings',
          domains: ['meeting'],
        },
        {
          id: 'pb-3',
          name: 'cross-domain',
          description: 'Cross domain',
          whenToUse: 'Multiple domains',
          domains: ['sales', 'meeting'],
        },
      ];

      const mockOrderBy = vi.fn().mockResolvedValue(mockPlaybooks);
      const mockFrom = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });
      mockDb.select = mockSelect;

      const salesPlaybooks = await getPlaybooksForDomain('sales');
      expect(salesPlaybooks).toHaveLength(2);
      expect(salesPlaybooks.map((p) => p.id)).toEqual(['pb-1', 'pb-3']);

      const meetingPlaybooks = await getPlaybooksForDomain('meeting');
      expect(meetingPlaybooks).toHaveLength(2);
      expect(meetingPlaybooks.map((p) => p.id)).toEqual(['pb-2', 'pb-3']);
    });

    it('should return empty array for non-existent domain', async () => {
      const mockPlaybooks = [
        {
          id: 'pb-1',
          name: 'test',
          description: 'test',
          whenToUse: 'test',
          domains: ['sales'],
        },
      ];

      const mockOrderBy = vi.fn().mockResolvedValue(mockPlaybooks);
      const mockFrom = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });
      mockDb.select = mockSelect;

      const result = await getPlaybooksForDomain('non-existent');
      expect(result).toEqual([]);
    });
  });

  describe('getPlaybookWithSteps', () => {
    it('should fetch playbook with steps ordered by sequence', async () => {
      const mockPlaybook = {
        id: 'pb-1',
        name: 'bant-validation',
        description: 'BANT validation',
        whenToUse: 'Sales calls',
        domains: ['sales'],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockSteps = [
        {
          id: 'step-1',
          playbookId: 'pb-1',
          sequence: 1,
          instruction: 'Extract BANT facts',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'step-2',
          playbookId: 'pb-1',
          sequence: 2,
          instruction: 'Validate with user',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      // Mock playbook query
      const mockLimit1 = vi.fn().mockResolvedValue([mockPlaybook]);
      const mockWhere1 = vi.fn().mockReturnValue({ limit: mockLimit1 });
      const mockFrom1 = vi.fn().mockReturnValue({ where: mockWhere1 });
      const mockSelect1 = vi.fn().mockReturnValue({ from: mockFrom1 });

      // Mock steps query
      const mockOrderBy = vi.fn().mockResolvedValue(mockSteps);
      const mockWhere2 = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      const mockFrom2 = vi.fn().mockReturnValue({ where: mockWhere2 });
      const mockSelect2 = vi.fn().mockReturnValue({ from: mockFrom2 });

      mockDb.select = vi
        .fn()
        .mockReturnValueOnce({ from: mockFrom1 })
        .mockReturnValueOnce({ from: mockFrom2 });

      const result = await getPlaybookWithSteps('pb-1');

      expect(result).toEqual({
        ...mockPlaybook,
        steps: mockSteps,
      });
    });

    it('should return null for non-existent playbook', async () => {
      const mockLimit = vi.fn().mockResolvedValue([]);
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });
      mockDb.select = mockSelect;

      const result = await getPlaybookWithSteps('non-existent');
      expect(result).toBeNull();
    });

    it('should return playbook with empty steps array if no steps exist', async () => {
      const mockPlaybook = {
        id: 'pb-1',
        name: 'test',
        description: null,
        whenToUse: null,
        domains: ['sales'],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockLimit = vi.fn().mockResolvedValue([mockPlaybook]);
      const mockWhere1 = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockFrom1 = vi.fn().mockReturnValue({ where: mockWhere1 });

      const mockOrderBy = vi.fn().mockResolvedValue([]);
      const mockWhere2 = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      const mockFrom2 = vi.fn().mockReturnValue({ where: mockWhere2 });

      mockDb.select = vi
        .fn()
        .mockReturnValueOnce({ from: mockFrom1 })
        .mockReturnValueOnce({ from: mockFrom2 });

      const result = await getPlaybookWithSteps('pb-1');

      expect(result).toEqual({
        ...mockPlaybook,
        steps: [],
      });
    });
  });

  describe('createPlaybook', () => {
    it('should create playbook with steps in transaction', async () => {
      const mockPlaybook = {
        id: 'pb-new',
        name: 'new-playbook',
        description: 'Test playbook',
        whenToUse: 'Test when to use',
        domains: ['sales'],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockReturning = vi.fn().mockResolvedValue([mockPlaybook]);
      const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
      const mockInsert = vi.fn().mockReturnValue({ values: mockValues });

      const mockTx = {
        insert: mockInsert,
      };

      mockDb.transaction = vi
        .fn()
        .mockImplementation(async (callback) => callback(mockTx));

      const result = await createPlaybook({
        name: 'new-playbook',
        description: 'Test playbook',
        whenToUse: 'Test when to use',
        domains: ['sales'],
        steps: [
          { sequence: 1, instruction: 'Step 1' },
          { sequence: 2, instruction: 'Step 2' },
        ],
      });

      expect(result).toEqual(mockPlaybook);
      expect(mockDb.transaction).toHaveBeenCalled();
      expect(mockInsert).toHaveBeenCalledTimes(2); // Once for playbook, once for steps
      expect(revalidateTag).toHaveBeenCalledWith('playbooks');
    });

    it('should create playbook without steps', async () => {
      const mockPlaybook = {
        id: 'pb-new',
        name: 'new-playbook',
        description: null,
        whenToUse: null,
        domains: ['sales'],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockReturning = vi.fn().mockResolvedValue([mockPlaybook]);
      const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
      const mockInsert = vi.fn().mockReturnValue({ values: mockValues });

      const mockTx = {
        insert: mockInsert,
      };

      mockDb.transaction = vi
        .fn()
        .mockImplementation(async (callback) => callback(mockTx));

      const result = await createPlaybook({
        name: 'new-playbook',
        domains: ['sales'],
        steps: [],
      });

      expect(result).toEqual(mockPlaybook);
      expect(mockInsert).toHaveBeenCalledTimes(1); // Only playbook insert
    });
  });

  describe('updatePlaybook', () => {
    it('should update playbook and invalidate cache', async () => {
      const mockUpdated = {
        id: 'pb-1',
        name: 'updated-name',
        description: 'Updated description',
        whenToUse: 'Updated when to use',
        domains: ['sales', 'meeting'],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockReturning = vi.fn().mockResolvedValue([mockUpdated]);
      const mockWhere = vi.fn().mockReturnValue({ returning: mockReturning });
      const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
      const mockUpdate = vi.fn().mockReturnValue({ set: mockSet });
      const mockDeleteWhere = vi.fn().mockResolvedValue(undefined);
      const mockDelete = vi.fn().mockReturnValue({ where: mockDeleteWhere });
      const mockInsert = vi.fn().mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      });

      const mockTx = {
        update: mockUpdate,
        delete: mockDelete,
        insert: mockInsert,
      };

      mockDb.transaction = vi
        .fn()
        .mockImplementation(async (callback) => callback(mockTx));

      const result = await updatePlaybook('pb-1', {
        name: 'updated-name',
        description: 'Updated description',
        whenToUse: 'Updated when to use',
        domains: ['sales', 'meeting'],
        steps: [{ sequence: 1, instruction: 'New step' }],
      });

      expect(result).toEqual(mockUpdated);
      expect(mockUpdate).toHaveBeenCalled();
      expect(mockDelete).toHaveBeenCalled(); // Delete old steps
      expect(mockInsert).toHaveBeenCalled(); // Insert new steps
      expect(revalidateTag).toHaveBeenCalledWith('playbooks');
      expect(revalidateTag).toHaveBeenCalledWith('playbook-pb-1');
    });

    it('should return null for non-existent playbook', async () => {
      const mockReturning = vi.fn().mockResolvedValue([]);
      const mockWhere = vi.fn().mockReturnValue({ returning: mockReturning });
      const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
      const mockUpdate = vi.fn().mockReturnValue({ set: mockSet });

      const mockTx = {
        update: mockUpdate,
      };

      mockDb.transaction = vi
        .fn()
        .mockImplementation(async (callback) => callback(mockTx));

      const result = await updatePlaybook('non-existent', {
        name: 'test',
      });

      expect(result).toBeNull();
    });

    it('should update playbook without updating steps', async () => {
      const mockUpdated = {
        id: 'pb-1',
        name: 'updated-name',
        description: 'Test',
        whenToUse: null,
        domains: ['sales'],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockReturning = vi.fn().mockResolvedValue([mockUpdated]);
      const mockWhere = vi.fn().mockReturnValue({ returning: mockReturning });
      const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
      const mockUpdate = vi.fn().mockReturnValue({ set: mockSet });

      const mockTx = {
        update: mockUpdate,
      };

      mockDb.transaction = vi
        .fn()
        .mockImplementation(async (callback) => callback(mockTx));

      const result = await updatePlaybook('pb-1', {
        name: 'updated-name',
      });

      expect(result).toEqual(mockUpdated);
      expect(mockUpdate).toHaveBeenCalled();
    });
  });

  describe('deletePlaybook', () => {
    it('should delete playbook and invalidate cache', async () => {
      const mockWhere = vi.fn().mockResolvedValue({ rowCount: 1 });
      const mockDelete = vi.fn().mockReturnValue({ where: mockWhere });
      mockDb.delete = mockDelete;

      const result = await deletePlaybook('pb-1');

      expect(result).toBe(true);
      expect(mockDelete).toHaveBeenCalled();
      expect(revalidateTag).toHaveBeenCalledWith('playbooks');
      expect(revalidateTag).toHaveBeenCalledWith('playbook-pb-1');
    });

    it('should return false when playbook does not exist', async () => {
      const mockWhere = vi.fn().mockResolvedValue({ rowCount: 0 });
      const mockDelete = vi.fn().mockReturnValue({ where: mockWhere });
      mockDb.delete = mockDelete;

      const result = await deletePlaybook('non-existent');

      expect(result).toBe(false);
    });
  });

  describe('listPlaybooks', () => {
    it('should call getAllPlaybooks', async () => {
      const mockPlaybooks = [
        {
          id: 'pb-1',
          name: 'test',
          description: null,
          whenToUse: null,
          domains: ['sales'],
        },
      ];

      const mockOrderBy = vi.fn().mockResolvedValue(mockPlaybooks);
      const mockFrom = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });
      mockDb.select = mockSelect;

      const result = await listPlaybooks();

      expect(result).toEqual(mockPlaybooks);
    });
  });
});
