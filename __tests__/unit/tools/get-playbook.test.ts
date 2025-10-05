import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getPlaybook } from '@/lib/ai/tools/get-playbook';
import * as playbookQueries from '@/lib/db/queries/playbooks';
import type { PlaybookMetadata, PlaybookWithSteps } from '@/lib/db/schema';

// Mock the playbook queries
vi.mock('@/lib/db/queries/playbooks', () => ({
  getPlaybooksForDomain: vi.fn(),
  getPlaybookWithSteps: vi.fn(),
}));

describe('getPlaybook Tool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Tool Building', () => {
    it('should return null when no playbooks exist for domain', async () => {
      vi.mocked(playbookQueries.getPlaybooksForDomain).mockResolvedValue([]);

      const tool = await getPlaybook({ domainId: 'sales' });

      expect(tool).toBeNull();
      expect(playbookQueries.getPlaybooksForDomain).toHaveBeenCalledWith(
        'sales',
      );
    });

    it('should build tool when playbooks exist for domain', async () => {
      const mockPlaybooks: PlaybookMetadata[] = [
        {
          id: '1',
          name: 'sales-call-analysis',
          description: 'Sales call BANT-C analysis',
          whenToUse: 'Use for sales calls',
          domains: ['sales'],
        },
      ];

      vi.mocked(playbookQueries.getPlaybooksForDomain).mockResolvedValue(
        mockPlaybooks,
      );

      const tool = await getPlaybook({ domainId: 'sales' });

      expect(tool).not.toBeNull();
      expect(tool).toHaveProperty('description');
      expect(tool).toHaveProperty('inputSchema');
      expect(tool).toHaveProperty('execute');
    });

    it('should create dynamic enum from playbook names', async () => {
      const mockPlaybooks: PlaybookMetadata[] = [
        {
          id: '1',
          name: 'sales-call-analysis',
          description: 'Sales call analysis',
          whenToUse: 'For sales calls',
          domains: ['sales'],
        },
        {
          id: '2',
          name: 'sales-strategy',
          description: 'Sales strategy',
          whenToUse: 'For strategy docs',
          domains: ['sales'],
        },
      ];

      vi.mocked(playbookQueries.getPlaybooksForDomain).mockResolvedValue(
        mockPlaybooks,
      );

      const tool = await getPlaybook({ domainId: 'sales' });

      expect(tool).not.toBeNull();
      // The enum should include both playbook names
      // We can't directly inspect the Zod schema, but we can test execution
    });
  });

  describe('Tool Execution', () => {
    const mockPlaybookWithSteps: PlaybookWithSteps = {
      id: '1',
      name: 'sales-call-analysis',
      description: 'Comprehensive sales call analysis',
      whenToUse: 'Use when analyzing sales call transcripts',
      domains: ['sales'],
      createdAt: new Date(),
      updatedAt: new Date(),
      steps: [
        {
          id: 'step-1',
          playbookId: '1',
          sequence: 1,
          instruction: 'Classify the transcript',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'step-2',
          playbookId: '1',
          sequence: 2,
          instruction: 'Extract BANT-C facts',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    };

    beforeEach(() => {
      const mockPlaybooks: PlaybookMetadata[] = [
        {
          id: '1',
          name: 'sales-call-analysis',
          description: 'Sales analysis',
          whenToUse: 'For sales',
          domains: ['sales'],
        },
      ];
      vi.mocked(playbookQueries.getPlaybooksForDomain).mockResolvedValue(
        mockPlaybooks,
      );
    });

    it('should successfully retrieve playbook with steps', async () => {
      vi.mocked(playbookQueries.getPlaybookWithSteps).mockResolvedValue(
        mockPlaybookWithSteps,
      );

      const tool = await getPlaybook({ domainId: 'sales' });
      expect(tool).not.toBeNull();

      const result = await tool?.execute({
        playbookName: 'sales-call-analysis',
      });

      expect(result.success).toBe(true);
      expect(result.playbook).toBeDefined();
      expect(result.playbook?.name).toBe('sales-call-analysis');
      expect(result.playbook?.stepCount).toBe(2);
      expect(result.playbook?.content).toContain('# sales-call-analysis');
      expect(result.playbook?.content).toContain('## Step 1:');
      expect(result.playbook?.content).toContain('## Step 2:');
      expect(result.playbook?.content).toContain('Classify the transcript');
      expect(result.playbook?.content).toContain('Extract BANT-C facts');
    });

    it('should handle playbook not found', async () => {
      // Mock no playbooks found (this shouldn't happen if tool was built correctly)
      vi.mocked(playbookQueries.getPlaybooksForDomain).mockResolvedValue([
        {
          id: '2',
          name: 'different-playbook',
          description: 'Different',
          whenToUse: 'Different use case',
          domains: ['sales'],
        },
      ]);

      const tool = await getPlaybook({ domainId: 'sales' });
      expect(tool).not.toBeNull();

      const result = await tool?.execute({
        playbookName: 'sales-call-analysis',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Playbook not found');
      expect(result.message).toContain('Could not find playbook');
    });

    it('should handle failed playbook loading', async () => {
      vi.mocked(playbookQueries.getPlaybookWithSteps).mockResolvedValue(null);

      const tool = await getPlaybook({ domainId: 'sales' });
      expect(tool).not.toBeNull();

      const result = await tool?.execute({
        playbookName: 'sales-call-analysis',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to load playbook');
      expect(result.message).toContain('Could not load playbook');
    });

    it('should handle unexpected errors during execution', async () => {
      vi.mocked(playbookQueries.getPlaybookWithSteps).mockRejectedValue(
        new Error('Database connection failed'),
      );

      const tool = await getPlaybook({ domainId: 'sales' });
      expect(tool).not.toBeNull();

      const result = await tool?.execute({
        playbookName: 'sales-call-analysis',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unexpected error');
      expect(result.message).toContain('Database connection failed');
    });

    it('should sort steps by sequence number', async () => {
      const unsortedSteps: PlaybookWithSteps = {
        ...mockPlaybookWithSteps,
        steps: [
          {
            id: 'step-3',
            playbookId: '1',
            sequence: 3,
            instruction: 'Third step',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: 'step-1',
            playbookId: '1',
            sequence: 1,
            instruction: 'First step',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: 'step-2',
            playbookId: '1',
            sequence: 2,
            instruction: 'Second step',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      };

      vi.mocked(playbookQueries.getPlaybookWithSteps).mockResolvedValue(
        unsortedSteps,
      );

      const tool = await getPlaybook({ domainId: 'sales' });
      expect(tool).not.toBeNull();

      const result = await tool?.execute({
        playbookName: 'sales-call-analysis',
      });

      expect(result.success).toBe(true);
      expect(result.playbook?.content).toMatch(/Step 1:.*First step/s);
      expect(result.playbook?.content).toMatch(/Step 2:.*Second step/s);
      expect(result.playbook?.content).toMatch(/Step 3:.*Third step/s);
    });

    it('should include description when present', async () => {
      vi.mocked(playbookQueries.getPlaybookWithSteps).mockResolvedValue(
        mockPlaybookWithSteps,
      );

      const tool = await getPlaybook({ domainId: 'sales' });
      expect(tool).not.toBeNull();

      const result = await tool?.execute({
        playbookName: 'sales-call-analysis',
      });

      expect(result.success).toBe(true);
      expect(result.playbook?.content).toContain('## Description');
      expect(result.playbook?.content).toContain(
        'Comprehensive sales call analysis',
      );
    });

    it('should handle playbook without description', async () => {
      const playbookNoDesc: PlaybookWithSteps = {
        ...mockPlaybookWithSteps,
        description: null,
      };

      vi.mocked(playbookQueries.getPlaybookWithSteps).mockResolvedValue(
        playbookNoDesc,
      );

      const tool = await getPlaybook({ domainId: 'sales' });
      expect(tool).not.toBeNull();

      const result = await tool?.execute({
        playbookName: 'sales-call-analysis',
      });

      expect(result.success).toBe(true);
      expect(result.playbook?.content).not.toContain('## Description');
      expect(result.playbook?.content).toContain(
        '## When to Use This Playbook',
      );
    });

    it('should include success criteria section', async () => {
      vi.mocked(playbookQueries.getPlaybookWithSteps).mockResolvedValue(
        mockPlaybookWithSteps,
      );

      const tool = await getPlaybook({ domainId: 'sales' });
      expect(tool).not.toBeNull();

      const result = await tool?.execute({
        playbookName: 'sales-call-analysis',
      });

      expect(result.success).toBe(true);
      expect(result.playbook?.content).toContain('## Success Criteria');
      expect(result.playbook?.content).toContain(
        'This playbook is complete when all validation steps',
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle playbook with no steps', async () => {
      const mockPlaybooks: PlaybookMetadata[] = [
        {
          id: '1',
          name: 'empty-playbook',
          description: 'Empty',
          whenToUse: 'Never',
          domains: ['sales'],
        },
      ];

      vi.mocked(playbookQueries.getPlaybooksForDomain).mockResolvedValue(
        mockPlaybooks,
      );

      const emptyPlaybook: PlaybookWithSteps = {
        id: '1',
        name: 'empty-playbook',
        description: 'Empty playbook',
        whenToUse: 'Never use this',
        domains: ['sales'],
        createdAt: new Date(),
        updatedAt: new Date(),
        steps: [],
      };

      vi.mocked(playbookQueries.getPlaybookWithSteps).mockResolvedValue(
        emptyPlaybook,
      );

      const tool = await getPlaybook({ domainId: 'sales' });
      expect(tool).not.toBeNull();

      const result = await tool?.execute({ playbookName: 'empty-playbook' });

      expect(result.success).toBe(true);
      expect(result.playbook?.stepCount).toBe(0);
      expect(result.playbook?.content).toContain('# empty-playbook');
    });

    it('should handle multiple domains', async () => {
      const mockPlaybooks: PlaybookMetadata[] = [
        {
          id: '1',
          name: 'multi-domain-playbook',
          description: 'Multi domain',
          whenToUse: 'For both',
          domains: ['sales', 'meeting'],
        },
      ];

      vi.mocked(playbookQueries.getPlaybooksForDomain).mockResolvedValue(
        mockPlaybooks,
      );

      const tool = await getPlaybook({ domainId: 'sales' });

      expect(tool).not.toBeNull();
    });
  });
});
