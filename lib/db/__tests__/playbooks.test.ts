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
  listPlaybooks,
} from '../queries/playbooks';
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
        },
        {
          id: 'pb-2',
          name: 'initiative-validation',
          description: 'Initiative validation playbook',
          whenToUse: 'Use for project meetings',
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
    it('should fetch playbooks for a specific domain using junction table', async () => {
      const mockPlaybooks = [
        {
          id: 'pb-1',
          name: 'bant-validation',
          description: 'BANT validation',
          whenToUse: 'Sales calls',
        },
        {
          id: 'pb-3',
          name: 'cross-domain',
          description: 'Cross domain',
          whenToUse: 'Multiple domains',
        },
      ];

      const mockOrderBy = vi.fn().mockResolvedValue(mockPlaybooks);
      const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      const mockInnerJoin = vi.fn().mockReturnValue({ where: mockWhere });
      const mockFrom = vi.fn().mockReturnValue({ innerJoin: mockInnerJoin });
      const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });
      mockDb.select = mockSelect;

      const result = await getPlaybooksForDomain('some-domain-uuid');
      expect(result).toEqual(mockPlaybooks);
      expect(mockSelect).toHaveBeenCalled();
      expect(mockInnerJoin).toHaveBeenCalled();
      expect(mockWhere).toHaveBeenCalled();
    });

    it('should return empty array when no playbooks match domain', async () => {
      const mockOrderBy = vi.fn().mockResolvedValue([]);
      const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      const mockInnerJoin = vi.fn().mockReturnValue({ where: mockWhere });
      const mockFrom = vi.fn().mockReturnValue({ innerJoin: mockInnerJoin });
      const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });
      mockDb.select = mockSelect;

      const result = await getPlaybooksForDomain('non-existent-uuid');
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

  describe('listPlaybooks', () => {
    it('should call getAllPlaybooks', async () => {
      const mockPlaybooks = [
        {
          id: 'pb-1',
          name: 'test',
          description: null,
          whenToUse: null,
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
