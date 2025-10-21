import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies FIRST
vi.mock('server-only', () => ({}));

// Mock next/cache
vi.mock('next/cache', () => ({
  revalidateTag: vi.fn(),
}));

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
  getAllPlaybooksWithDomains,
  getPlaybookWithDomains,
  createPlaybook,
  updatePlaybook,
  deletePlaybook,
  type AdminPlaybook,
} from '../playbooks';
import { revalidateTag } from 'next/cache';
import { db } from '@/lib/db/queries';

describe('Admin Playbook DAL Functions', () => {
  const mockDb = db as any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getAllPlaybooksWithDomains', () => {
    it('should fetch all playbooks with domains and steps using LEFT JOIN', async () => {
      const mockPlaybookRows = [
        {
          playbookId: 'pb-550e8400-e29b-41d4-a716-446655440000',
          playbookName: 'bant-validation',
          playbookDescription: 'BANT validation playbook',
          playbookWhenToUse: 'Use for sales calls',
          playbookCreatedAt: new Date('2024-01-01'),
          playbookUpdatedAt: new Date('2024-01-02'),
          domainId: '550e8400-e29b-41d4-a716-446655440001',
          domainTitle: 'Sales Intelligence',
        },
        {
          playbookId: 'pb-550e8400-e29b-41d4-a716-446655440000',
          playbookName: 'bant-validation',
          playbookDescription: 'BANT validation playbook',
          playbookWhenToUse: 'Use for sales calls',
          playbookCreatedAt: new Date('2024-01-01'),
          playbookUpdatedAt: new Date('2024-01-02'),
          domainId: '550e8400-e29b-41d4-a716-446655440002',
          domainTitle: 'Sales Enablement',
        },
        {
          playbookId: 'pb-550e8400-e29b-41d4-a716-446655440003',
          playbookName: 'initiative-validation',
          playbookDescription: 'Initiative validation playbook',
          playbookWhenToUse: 'Use for project meetings',
          playbookCreatedAt: new Date('2024-01-03'),
          playbookUpdatedAt: new Date('2024-01-04'),
          domainId: '550e8400-e29b-41d4-a716-446655440004',
          domainTitle: 'Project Management',
        },
      ];

      const mockSteps = [
        {
          playbookId: 'pb-550e8400-e29b-41d4-a716-446655440000',
          id: 'step-1',
          sequence: 1,
          instruction: 'Extract BANT facts',
          toolCall: null,
          condition: null,
        },
        {
          playbookId: 'pb-550e8400-e29b-41d4-a716-446655440000',
          id: 'step-2',
          sequence: 2,
          instruction: 'Validate with user',
          toolCall: 'validateFacts',
          condition: 'hasExtractedFacts',
        },
        {
          playbookId: 'pb-550e8400-e29b-41d4-a716-446655440003',
          id: 'step-3',
          sequence: 1,
          instruction: 'Review initiative',
          toolCall: null,
          condition: null,
        },
      ];

      // Mock playbooks with domains query (first select)
      const mockOrderBy1 = vi.fn().mockResolvedValue(mockPlaybookRows);
      const mockLeftJoin2 = vi.fn().mockReturnValue({ orderBy: mockOrderBy1 });
      const mockLeftJoin1 = vi
        .fn()
        .mockReturnValue({ leftJoin: mockLeftJoin2 });
      const mockFrom1 = vi.fn().mockReturnValue({ leftJoin: mockLeftJoin1 });

      // Mock steps query (second select)
      const mockOrderBy2 = vi.fn().mockResolvedValue(mockSteps);
      const mockFrom2 = vi.fn().mockReturnValue({ orderBy: mockOrderBy2 });

      // Setup select to return different chains for each call
      mockDb.select = vi
        .fn()
        .mockReturnValueOnce({ from: mockFrom1 })
        .mockReturnValueOnce({ from: mockFrom2 });

      const result = await getAllPlaybooksWithDomains();

      expect(result).toHaveLength(2);

      // Verify first playbook
      expect(result[0]).toEqual({
        id: 'pb-550e8400-e29b-41d4-a716-446655440000',
        name: 'bant-validation',
        description: 'BANT validation playbook',
        whenToUse: 'Use for sales calls',
        domains: [
          {
            id: '550e8400-e29b-41d4-a716-446655440001',
            title: 'Sales Intelligence',
          },
          {
            id: '550e8400-e29b-41d4-a716-446655440002',
            title: 'Sales Enablement',
          },
        ],
        steps: [
          {
            id: 'step-1',
            sequence: 1,
            instruction: 'Extract BANT facts',
            toolCall: null,
            condition: null,
          },
          {
            id: 'step-2',
            sequence: 2,
            instruction: 'Validate with user',
            toolCall: 'validateFacts',
            condition: 'hasExtractedFacts',
          },
        ],
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-02'),
      });

      // Verify second playbook
      expect(result[1]).toEqual({
        id: 'pb-550e8400-e29b-41d4-a716-446655440003',
        name: 'initiative-validation',
        description: 'Initiative validation playbook',
        whenToUse: 'Use for project meetings',
        domains: [
          {
            id: '550e8400-e29b-41d4-a716-446655440004',
            title: 'Project Management',
          },
        ],
        steps: [
          {
            id: 'step-3',
            sequence: 1,
            instruction: 'Review initiative',
            toolCall: null,
            condition: null,
          },
        ],
        createdAt: new Date('2024-01-03'),
        updatedAt: new Date('2024-01-04'),
      });

      expect(mockDb.select).toHaveBeenCalledTimes(2);
    });

    it('should return empty array when no playbooks exist', async () => {
      const mockOrderBy1 = vi.fn().mockResolvedValue([]);
      const mockLeftJoin2 = vi.fn().mockReturnValue({ orderBy: mockOrderBy1 });
      const mockLeftJoin1 = vi
        .fn()
        .mockReturnValue({ leftJoin: mockLeftJoin2 });
      const mockFrom1 = vi.fn().mockReturnValue({ leftJoin: mockLeftJoin1 });

      const mockOrderBy2 = vi.fn().mockResolvedValue([]);
      const mockFrom2 = vi.fn().mockReturnValue({ orderBy: mockOrderBy2 });

      mockDb.select = vi
        .fn()
        .mockReturnValueOnce({ from: mockFrom1 })
        .mockReturnValueOnce({ from: mockFrom2 });

      const result = await getAllPlaybooksWithDomains();

      expect(result).toEqual([]);
    });

    it('should handle playbooks with no domains (LEFT JOIN returns null)', async () => {
      const mockPlaybookRows = [
        {
          playbookId: 'pb-550e8400-e29b-41d4-a716-446655440000',
          playbookName: 'orphan-playbook',
          playbookDescription: 'Playbook with no domains',
          playbookWhenToUse: 'Test playbook',
          playbookCreatedAt: new Date('2024-01-01'),
          playbookUpdatedAt: new Date('2024-01-02'),
          domainId: null,
          domainTitle: null,
        },
      ];

      const mockSteps = [
        {
          playbookId: 'pb-550e8400-e29b-41d4-a716-446655440000',
          id: 'step-1',
          sequence: 1,
          instruction: 'Test step',
          toolCall: null,
          condition: null,
        },
      ];

      const mockOrderBy1 = vi.fn().mockResolvedValue(mockPlaybookRows);
      const mockLeftJoin2 = vi.fn().mockReturnValue({ orderBy: mockOrderBy1 });
      const mockLeftJoin1 = vi
        .fn()
        .mockReturnValue({ leftJoin: mockLeftJoin2 });
      const mockFrom1 = vi.fn().mockReturnValue({ leftJoin: mockLeftJoin1 });

      const mockOrderBy2 = vi.fn().mockResolvedValue(mockSteps);
      const mockFrom2 = vi.fn().mockReturnValue({ orderBy: mockOrderBy2 });

      mockDb.select = vi
        .fn()
        .mockReturnValueOnce({ from: mockFrom1 })
        .mockReturnValueOnce({ from: mockFrom2 });

      const result = await getAllPlaybooksWithDomains();

      expect(result).toHaveLength(1);
      expect(result[0].domains).toEqual([]);
      expect(result[0].steps).toHaveLength(1);
    });
  });

  describe('getPlaybookWithDomains', () => {
    it('should fetch single playbook with domains and steps', async () => {
      const mockPlaybookRows = [
        {
          playbookId: 'pb-550e8400-e29b-41d4-a716-446655440000',
          playbookName: 'bant-validation',
          playbookDescription: 'BANT validation playbook',
          playbookWhenToUse: 'Use for sales calls',
          playbookCreatedAt: new Date('2024-01-01'),
          playbookUpdatedAt: new Date('2024-01-02'),
          domainId: '550e8400-e29b-41d4-a716-446655440001',
          domainTitle: 'Sales Intelligence',
        },
        {
          playbookId: 'pb-550e8400-e29b-41d4-a716-446655440000',
          playbookName: 'bant-validation',
          playbookDescription: 'BANT validation playbook',
          playbookWhenToUse: 'Use for sales calls',
          playbookCreatedAt: new Date('2024-01-01'),
          playbookUpdatedAt: new Date('2024-01-02'),
          domainId: '550e8400-e29b-41d4-a716-446655440002',
          domainTitle: 'Sales Enablement',
        },
      ];

      const mockSteps = [
        {
          id: 'step-1',
          sequence: 1,
          instruction: 'Extract BANT facts',
          toolCall: null,
          condition: null,
        },
        {
          id: 'step-2',
          sequence: 2,
          instruction: 'Validate with user',
          toolCall: 'validateFacts',
          condition: 'hasExtractedFacts',
        },
      ];

      // Mock playbook query (first select)
      const mockWhere1 = vi.fn().mockResolvedValue(mockPlaybookRows);
      const mockLeftJoin2 = vi.fn().mockReturnValue({ where: mockWhere1 });
      const mockLeftJoin1 = vi
        .fn()
        .mockReturnValue({ leftJoin: mockLeftJoin2 });
      const mockFrom1 = vi.fn().mockReturnValue({ leftJoin: mockLeftJoin1 });

      // Mock steps query (second select)
      const mockOrderBy = vi.fn().mockResolvedValue(mockSteps);
      const mockWhere2 = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      const mockFrom2 = vi.fn().mockReturnValue({ where: mockWhere2 });

      mockDb.select = vi
        .fn()
        .mockReturnValueOnce({ from: mockFrom1 })
        .mockReturnValueOnce({ from: mockFrom2 });

      const result = await getPlaybookWithDomains(
        'pb-550e8400-e29b-41d4-a716-446655440000',
      );

      expect(result).toEqual({
        id: 'pb-550e8400-e29b-41d4-a716-446655440000',
        name: 'bant-validation',
        description: 'BANT validation playbook',
        whenToUse: 'Use for sales calls',
        domains: [
          {
            id: '550e8400-e29b-41d4-a716-446655440001',
            title: 'Sales Intelligence',
          },
          {
            id: '550e8400-e29b-41d4-a716-446655440002',
            title: 'Sales Enablement',
          },
        ],
        steps: mockSteps,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-02'),
      });
    });

    it('should return null for non-existent playbook', async () => {
      const mockWhere = vi.fn().mockResolvedValue([]);
      const mockLeftJoin2 = vi.fn().mockReturnValue({ where: mockWhere });
      const mockLeftJoin1 = vi
        .fn()
        .mockReturnValue({ leftJoin: mockLeftJoin2 });
      const mockFrom = vi.fn().mockReturnValue({ leftJoin: mockLeftJoin1 });
      mockDb.select = vi.fn().mockReturnValue({ from: mockFrom });

      const result = await getPlaybookWithDomains('non-existent-id');

      expect(result).toBeNull();
    });

    it('should handle playbook with no domains', async () => {
      const mockPlaybookRows = [
        {
          playbookId: 'pb-550e8400-e29b-41d4-a716-446655440000',
          playbookName: 'orphan-playbook',
          playbookDescription: 'No domains',
          playbookWhenToUse: 'Test',
          playbookCreatedAt: new Date('2024-01-01'),
          playbookUpdatedAt: new Date('2024-01-02'),
          domainId: null,
          domainTitle: null,
        },
      ];

      const mockSteps = [
        {
          id: 'step-1',
          sequence: 1,
          instruction: 'Test step',
          toolCall: null,
          condition: null,
        },
      ];

      const mockWhere1 = vi.fn().mockResolvedValue(mockPlaybookRows);
      const mockLeftJoin2 = vi.fn().mockReturnValue({ where: mockWhere1 });
      const mockLeftJoin1 = vi
        .fn()
        .mockReturnValue({ leftJoin: mockLeftJoin2 });
      const mockFrom1 = vi.fn().mockReturnValue({ leftJoin: mockLeftJoin1 });

      const mockOrderBy = vi.fn().mockResolvedValue(mockSteps);
      const mockWhere2 = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      const mockFrom2 = vi.fn().mockReturnValue({ where: mockWhere2 });

      mockDb.select = vi
        .fn()
        .mockReturnValueOnce({ from: mockFrom1 })
        .mockReturnValueOnce({ from: mockFrom2 });

      const result = await getPlaybookWithDomains(
        'pb-550e8400-e29b-41d4-a716-446655440000',
      );

      expect(result).not.toBeNull();
      expect(result?.domains).toEqual([]);
      expect(result?.steps).toEqual(mockSteps);
    });

    it('should handle playbook with no steps', async () => {
      const mockPlaybookRows = [
        {
          playbookId: 'pb-550e8400-e29b-41d4-a716-446655440000',
          playbookName: 'no-steps',
          playbookDescription: 'No steps',
          playbookWhenToUse: 'Test',
          playbookCreatedAt: new Date('2024-01-01'),
          playbookUpdatedAt: new Date('2024-01-02'),
          domainId: '550e8400-e29b-41d4-a716-446655440001',
          domainTitle: 'Sales Intelligence',
        },
      ];

      const mockWhere1 = vi.fn().mockResolvedValue(mockPlaybookRows);
      const mockLeftJoin2 = vi.fn().mockReturnValue({ where: mockWhere1 });
      const mockLeftJoin1 = vi
        .fn()
        .mockReturnValue({ leftJoin: mockLeftJoin2 });
      const mockFrom1 = vi.fn().mockReturnValue({ leftJoin: mockLeftJoin1 });

      const mockOrderBy = vi.fn().mockResolvedValue([]);
      const mockWhere2 = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      const mockFrom2 = vi.fn().mockReturnValue({ where: mockWhere2 });

      mockDb.select = vi
        .fn()
        .mockReturnValueOnce({ from: mockFrom1 })
        .mockReturnValueOnce({ from: mockFrom2 });

      const result = await getPlaybookWithDomains(
        'pb-550e8400-e29b-41d4-a716-446655440000',
      );

      expect(result).not.toBeNull();
      expect(result?.domains).toHaveLength(1);
      expect(result?.steps).toEqual([]);
    });
  });

  describe('createPlaybook', () => {
    it('should create playbook with domains and steps in transaction', async () => {
      const newPlaybookData = {
        name: 'new-playbook',
        description: 'New playbook description',
        whenToUse: 'When to use this playbook',
        domainIds: [
          '550e8400-e29b-41d4-a716-446655440001',
          '550e8400-e29b-41d4-a716-446655440002',
        ],
        steps: [
          {
            sequence: 1,
            instruction: 'First step',
            toolCall: 'extractData',
            condition: null,
          },
          {
            sequence: 2,
            instruction: 'Second step',
            toolCall: null,
            condition: 'hasData',
          },
        ],
      };

      const mockCreatedPlaybook = {
        id: 'pb-550e8400-e29b-41d4-a716-446655440000',
        name: newPlaybookData.name,
        description: newPlaybookData.description,
        whenToUse: newPlaybookData.whenToUse,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      };

      const mockFullPlaybook: AdminPlaybook = {
        id: mockCreatedPlaybook.id,
        name: mockCreatedPlaybook.name,
        description: mockCreatedPlaybook.description,
        whenToUse: mockCreatedPlaybook.whenToUse,
        domains: [
          {
            id: '550e8400-e29b-41d4-a716-446655440001',
            title: 'Sales Intelligence',
          },
          {
            id: '550e8400-e29b-41d4-a716-446655440002',
            title: 'Sales Enablement',
          },
        ],
        steps: [
          {
            id: 'step-1',
            sequence: 1,
            instruction: 'First step',
            toolCall: 'extractData',
            condition: null,
          },
          {
            id: 'step-2',
            sequence: 2,
            instruction: 'Second step',
            toolCall: null,
            condition: 'hasData',
          },
        ],
        createdAt: mockCreatedPlaybook.createdAt,
        updatedAt: mockCreatedPlaybook.updatedAt,
      };

      // Mock transaction
      const mockTx = {
        insert: vi.fn().mockReturnThis(),
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([mockCreatedPlaybook]),
      };

      mockDb.transaction = vi.fn().mockImplementation(async (callback) => {
        return callback(mockTx);
      });

      // Mock getPlaybookWithDomains call
      const mockPlaybookRows = [
        {
          playbookId: mockCreatedPlaybook.id,
          playbookName: mockCreatedPlaybook.name,
          playbookDescription: mockCreatedPlaybook.description,
          playbookWhenToUse: mockCreatedPlaybook.whenToUse,
          playbookCreatedAt: mockCreatedPlaybook.createdAt,
          playbookUpdatedAt: mockCreatedPlaybook.updatedAt,
          domainId: '550e8400-e29b-41d4-a716-446655440001',
          domainTitle: 'Sales Intelligence',
        },
        {
          playbookId: mockCreatedPlaybook.id,
          playbookName: mockCreatedPlaybook.name,
          playbookDescription: mockCreatedPlaybook.description,
          playbookWhenToUse: mockCreatedPlaybook.whenToUse,
          playbookCreatedAt: mockCreatedPlaybook.createdAt,
          playbookUpdatedAt: mockCreatedPlaybook.updatedAt,
          domainId: '550e8400-e29b-41d4-a716-446655440002',
          domainTitle: 'Sales Enablement',
        },
      ];

      const mockWhere1 = vi.fn().mockResolvedValue(mockPlaybookRows);
      const mockLeftJoin2 = vi.fn().mockReturnValue({ where: mockWhere1 });
      const mockLeftJoin1 = vi
        .fn()
        .mockReturnValue({ leftJoin: mockLeftJoin2 });
      const mockFrom1 = vi.fn().mockReturnValue({ leftJoin: mockLeftJoin1 });

      const mockOrderBy = vi.fn().mockResolvedValue(mockFullPlaybook.steps);
      const mockWhere2 = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      const mockFrom2 = vi.fn().mockReturnValue({ where: mockWhere2 });

      mockDb.select = vi
        .fn()
        .mockReturnValueOnce({ from: mockFrom1 })
        .mockReturnValueOnce({ from: mockFrom2 });

      const result = await createPlaybook(newPlaybookData);

      expect(result).toEqual(mockFullPlaybook);
      expect(mockDb.transaction).toHaveBeenCalledTimes(1);
      expect(mockTx.insert).toHaveBeenCalledTimes(3); // playbook, domains, steps
      expect(revalidateTag).toHaveBeenCalledWith('playbooks');
    });

    it('should create playbook with no domains or steps', async () => {
      const newPlaybookData = {
        name: 'minimal-playbook',
        description: 'Minimal playbook',
        whenToUse: 'Test',
        domainIds: [],
        steps: [],
      };

      const mockCreatedPlaybook = {
        id: 'pb-550e8400-e29b-41d4-a716-446655440000',
        name: newPlaybookData.name,
        description: newPlaybookData.description,
        whenToUse: newPlaybookData.whenToUse,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      };

      const mockFullPlaybook: AdminPlaybook = {
        ...mockCreatedPlaybook,
        domains: [],
        steps: [],
      };

      const mockTx = {
        insert: vi.fn().mockReturnThis(),
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([mockCreatedPlaybook]),
      };

      mockDb.transaction = vi.fn().mockImplementation(async (callback) => {
        return callback(mockTx);
      });

      // Mock getPlaybookWithDomains
      const mockPlaybookRows = [
        {
          playbookId: mockCreatedPlaybook.id,
          playbookName: mockCreatedPlaybook.name,
          playbookDescription: mockCreatedPlaybook.description,
          playbookWhenToUse: mockCreatedPlaybook.whenToUse,
          playbookCreatedAt: mockCreatedPlaybook.createdAt,
          playbookUpdatedAt: mockCreatedPlaybook.updatedAt,
          domainId: null,
          domainTitle: null,
        },
      ];

      const mockWhere1 = vi.fn().mockResolvedValue(mockPlaybookRows);
      const mockLeftJoin2 = vi.fn().mockReturnValue({ where: mockWhere1 });
      const mockLeftJoin1 = vi
        .fn()
        .mockReturnValue({ leftJoin: mockLeftJoin2 });
      const mockFrom1 = vi.fn().mockReturnValue({ leftJoin: mockLeftJoin1 });

      const mockOrderBy = vi.fn().mockResolvedValue([]);
      const mockWhere2 = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      const mockFrom2 = vi.fn().mockReturnValue({ where: mockWhere2 });

      mockDb.select = vi
        .fn()
        .mockReturnValueOnce({ from: mockFrom1 })
        .mockReturnValueOnce({ from: mockFrom2 });

      const result = await createPlaybook(newPlaybookData);

      expect(result).toEqual(mockFullPlaybook);
      expect(mockTx.insert).toHaveBeenCalledTimes(1); // Only playbook, no domains/steps
      expect(revalidateTag).toHaveBeenCalledWith('playbooks');
    });
  });

  describe('updatePlaybook', () => {
    it('should update playbook with new domains and steps', async () => {
      const updateData = {
        name: 'updated-name',
        description: 'Updated description',
        whenToUse: 'Updated when to use',
        domainIds: ['550e8400-e29b-41d4-a716-446655440001'],
        steps: [
          {
            sequence: 1,
            instruction: 'Updated step',
            toolCall: 'newTool',
            condition: 'newCondition',
          },
        ],
      };

      const mockUpdatedPlaybook = {
        id: 'pb-550e8400-e29b-41d4-a716-446655440000',
        name: updateData.name,
        description: updateData.description,
        whenToUse: updateData.whenToUse,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-05'),
      };

      const mockFullPlaybook: AdminPlaybook = {
        ...mockUpdatedPlaybook,
        domains: [
          {
            id: '550e8400-e29b-41d4-a716-446655440001',
            title: 'Sales Intelligence',
          },
        ],
        steps: [
          {
            id: 'step-new',
            sequence: 1,
            instruction: 'Updated step',
            toolCall: 'newTool',
            condition: 'newCondition',
          },
        ],
      };

      // Mock transaction
      const mockTx = {
        update: vi.fn().mockReturnThis(),
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([mockUpdatedPlaybook]),
        delete: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        values: vi.fn().mockReturnThis(),
      };

      mockDb.transaction = vi.fn().mockImplementation(async (callback) => {
        return callback(mockTx);
      });

      // Mock getPlaybookWithDomains
      const mockPlaybookRows = [
        {
          playbookId: mockUpdatedPlaybook.id,
          playbookName: mockUpdatedPlaybook.name,
          playbookDescription: mockUpdatedPlaybook.description,
          playbookWhenToUse: mockUpdatedPlaybook.whenToUse,
          playbookCreatedAt: mockUpdatedPlaybook.createdAt,
          playbookUpdatedAt: mockUpdatedPlaybook.updatedAt,
          domainId: '550e8400-e29b-41d4-a716-446655440001',
          domainTitle: 'Sales Intelligence',
        },
      ];

      const mockWhere1 = vi.fn().mockResolvedValue(mockPlaybookRows);
      const mockLeftJoin2 = vi.fn().mockReturnValue({ where: mockWhere1 });
      const mockLeftJoin1 = vi
        .fn()
        .mockReturnValue({ leftJoin: mockLeftJoin2 });
      const mockFrom1 = vi.fn().mockReturnValue({ leftJoin: mockLeftJoin1 });

      const mockOrderBy = vi.fn().mockResolvedValue(mockFullPlaybook.steps);
      const mockWhere2 = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      const mockFrom2 = vi.fn().mockReturnValue({ where: mockWhere2 });

      mockDb.select = vi
        .fn()
        .mockReturnValueOnce({ from: mockFrom1 })
        .mockReturnValueOnce({ from: mockFrom2 });

      const result = await updatePlaybook(
        'pb-550e8400-e29b-41d4-a716-446655440000',
        updateData,
      );

      expect(result).toEqual(mockFullPlaybook);
      expect(mockDb.transaction).toHaveBeenCalledTimes(1);
      expect(mockTx.update).toHaveBeenCalledTimes(1);
      expect(mockTx.delete).toHaveBeenCalledTimes(2); // Delete old domains and steps
      expect(mockTx.insert).toHaveBeenCalledTimes(2); // Insert new domains and steps
      expect(revalidateTag).toHaveBeenCalledWith('playbooks');
      expect(revalidateTag).toHaveBeenCalledWith(
        'playbook-pb-550e8400-e29b-41d4-a716-446655440000',
      );
    });

    it('should return null when playbook does not exist', async () => {
      const mockTx = {
        update: vi.fn().mockReturnThis(),
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([]),
      };

      mockDb.transaction = vi.fn().mockImplementation(async (callback) => {
        return callback(mockTx);
      });

      const result = await updatePlaybook('non-existent-id', {
        name: 'test',
      });

      expect(result).toBeNull();
      expect(revalidateTag).not.toHaveBeenCalled();
    });

    it('should update only name without touching domains or steps', async () => {
      const updateData = {
        name: 'new-name-only',
      };

      const mockUpdatedPlaybook = {
        id: 'pb-550e8400-e29b-41d4-a716-446655440000',
        name: updateData.name,
        description: 'Original description',
        whenToUse: 'Original when to use',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-05'),
      };

      const mockFullPlaybook: AdminPlaybook = {
        ...mockUpdatedPlaybook,
        domains: [
          {
            id: '550e8400-e29b-41d4-a716-446655440001',
            title: 'Sales Intelligence',
          },
        ],
        steps: [
          {
            id: 'step-1',
            sequence: 1,
            instruction: 'Original step',
            toolCall: null,
            condition: null,
          },
        ],
      };

      const mockTx = {
        update: vi.fn().mockReturnThis(),
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([mockUpdatedPlaybook]),
      };

      mockDb.transaction = vi.fn().mockImplementation(async (callback) => {
        return callback(mockTx);
      });

      // Mock getPlaybookWithDomains
      const mockPlaybookRows = [
        {
          playbookId: mockUpdatedPlaybook.id,
          playbookName: mockUpdatedPlaybook.name,
          playbookDescription: mockUpdatedPlaybook.description,
          playbookWhenToUse: mockUpdatedPlaybook.whenToUse,
          playbookCreatedAt: mockUpdatedPlaybook.createdAt,
          playbookUpdatedAt: mockUpdatedPlaybook.updatedAt,
          domainId: '550e8400-e29b-41d4-a716-446655440001',
          domainTitle: 'Sales Intelligence',
        },
      ];

      const mockWhere1 = vi.fn().mockResolvedValue(mockPlaybookRows);
      const mockLeftJoin2 = vi.fn().mockReturnValue({ where: mockWhere1 });
      const mockLeftJoin1 = vi
        .fn()
        .mockReturnValue({ leftJoin: mockLeftJoin2 });
      const mockFrom1 = vi.fn().mockReturnValue({ leftJoin: mockLeftJoin1 });

      const mockOrderBy = vi.fn().mockResolvedValue(mockFullPlaybook.steps);
      const mockWhere2 = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      const mockFrom2 = vi.fn().mockReturnValue({ where: mockWhere2 });

      mockDb.select = vi
        .fn()
        .mockReturnValueOnce({ from: mockFrom1 })
        .mockReturnValueOnce({ from: mockFrom2 });

      const result = await updatePlaybook(
        'pb-550e8400-e29b-41d4-a716-446655440000',
        updateData,
      );

      expect(result).toEqual(mockFullPlaybook);
      expect(mockTx.update).toHaveBeenCalledTimes(1);
      // Should NOT call delete or insert for domains/steps since not provided
      expect(mockTx.delete).toBeUndefined();
      expect(mockTx.insert).toBeUndefined();
    });
  });

  describe('deletePlaybook', () => {
    it('should delete playbook and invalidate cache', async () => {
      const mockDeleted = [
        {
          id: 'pb-550e8400-e29b-41d4-a716-446655440000',
          name: 'deleted-playbook',
        },
      ];

      const mockReturning = vi.fn().mockResolvedValue(mockDeleted);
      const mockWhere = vi.fn().mockReturnValue({ returning: mockReturning });
      mockDb.delete = vi.fn().mockReturnValue({ where: mockWhere });

      const result = await deletePlaybook(
        'pb-550e8400-e29b-41d4-a716-446655440000',
      );

      expect(result).toBe(true);
      expect(mockDb.delete).toHaveBeenCalledTimes(1);
      expect(revalidateTag).toHaveBeenCalledWith('playbooks');
      expect(revalidateTag).toHaveBeenCalledWith(
        'playbook-pb-550e8400-e29b-41d4-a716-446655440000',
      );
    });

    it('should return false when playbook does not exist', async () => {
      const mockReturning = vi.fn().mockResolvedValue([]);
      const mockWhere = vi.fn().mockReturnValue({ returning: mockReturning });
      mockDb.delete = vi.fn().mockReturnValue({ where: mockWhere });

      const result = await deletePlaybook('non-existent-id');

      expect(result).toBe(false);
      expect(revalidateTag).toHaveBeenCalledWith('playbooks');
      expect(revalidateTag).toHaveBeenCalledWith('playbook-non-existent-id');
    });
  });
});
