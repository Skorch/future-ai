import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createPlaybook,
  updatePlaybook,
  deletePlaybook,
} from '@/app/admin/playbooks/actions';
import * as playbookQueries from '@/lib/db/queries/playbooks';
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

vi.mock('@/lib/db/queries/playbooks', () => ({
  createPlaybook: vi.fn(),
  updatePlaybook: vi.fn(),
  deletePlaybook: vi.fn(),
}));

describe('Playbook Server Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createPlaybook', () => {
    it('should create a playbook when user is authenticated', async () => {
      const mockPlaybook = {
        id: 'test-id',
        name: 'test-playbook',
        description: 'Test description',
        whenToUse: 'When testing',
        domains: ['sales'],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(auth).mockResolvedValue({ userId: 'user-123' } as any);
      vi.mocked(playbookQueries.createPlaybook).mockResolvedValue(
        mockPlaybook as any,
      );

      const data = {
        name: 'test-playbook',
        description: 'Test description',
        whenToUse: 'When testing',
        domains: ['sales'],
        steps: [
          { sequence: 1, instruction: 'Step 1' },
          { sequence: 2, instruction: 'Step 2' },
        ],
      };

      const result = await createPlaybook(data);

      expect(auth).toHaveBeenCalled();
      expect(playbookQueries.createPlaybook).toHaveBeenCalledWith(data);
      expect(result).toEqual(mockPlaybook);
    });

    it('should redirect to login when user is not authenticated', async () => {
      vi.mocked(auth).mockResolvedValue({ userId: null } as any);

      const data = {
        name: 'test-playbook',
        domains: ['sales'],
        steps: [{ sequence: 1, instruction: 'Step 1' }],
      };

      await expect(createPlaybook(data)).rejects.toThrow('NEXT_REDIRECT');
      expect(redirect).toHaveBeenCalledWith('/login');
      expect(playbookQueries.createPlaybook).not.toHaveBeenCalled();
    });

    it('should handle optional fields correctly', async () => {
      vi.mocked(auth).mockResolvedValue({ userId: 'user-123' } as any);
      vi.mocked(playbookQueries.createPlaybook).mockResolvedValue({} as any);

      const data = {
        name: 'minimal-playbook',
        domains: ['sales'],
        steps: [{ sequence: 1, instruction: 'Only step' }],
      };

      await createPlaybook(data);

      expect(playbookQueries.createPlaybook).toHaveBeenCalledWith(data);
    });

    it('should handle multiple domains', async () => {
      vi.mocked(auth).mockResolvedValue({ userId: 'user-123' } as any);
      vi.mocked(playbookQueries.createPlaybook).mockResolvedValue({} as any);

      const data = {
        name: 'multi-domain-playbook',
        domains: ['sales', 'meeting'],
        steps: [{ sequence: 1, instruction: 'Step 1' }],
      };

      await createPlaybook(data);

      expect(playbookQueries.createPlaybook).toHaveBeenCalledWith(
        expect.objectContaining({
          domains: ['sales', 'meeting'],
        }),
      );
    });
  });

  describe('updatePlaybook', () => {
    it('should update a playbook when user is authenticated', async () => {
      const mockUpdated = {
        id: 'playbook-id',
        name: 'updated-playbook',
        description: 'Updated description',
        whenToUse: 'When updated',
        domains: ['meeting'],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(auth).mockResolvedValue({ userId: 'user-123' } as any);
      vi.mocked(playbookQueries.updatePlaybook).mockResolvedValue(
        mockUpdated as any,
      );

      const data = {
        name: 'updated-playbook',
        description: 'Updated description',
        domains: ['meeting'],
        steps: [
          { sequence: 1, instruction: 'Updated step 1' },
          { sequence: 2, instruction: 'Updated step 2' },
        ],
      };

      const result = await updatePlaybook('playbook-id', data);

      expect(auth).toHaveBeenCalled();
      expect(playbookQueries.updatePlaybook).toHaveBeenCalledWith(
        'playbook-id',
        data,
      );
      expect(result).toEqual(mockUpdated);
    });

    it('should redirect to login when user is not authenticated', async () => {
      vi.mocked(auth).mockResolvedValue({ userId: null } as any);

      await expect(
        updatePlaybook('playbook-id', { name: 'updated' }),
      ).rejects.toThrow('NEXT_REDIRECT');
      expect(redirect).toHaveBeenCalledWith('/login');
      expect(playbookQueries.updatePlaybook).not.toHaveBeenCalled();
    });

    it('should handle partial updates', async () => {
      vi.mocked(auth).mockResolvedValue({ userId: 'user-123' } as any);
      vi.mocked(playbookQueries.updatePlaybook).mockResolvedValue({} as any);

      const partialData = {
        description: 'Only updating description',
      };

      await updatePlaybook('playbook-id', partialData);

      expect(playbookQueries.updatePlaybook).toHaveBeenCalledWith(
        'playbook-id',
        partialData,
      );
    });

    it('should handle updating only steps', async () => {
      vi.mocked(auth).mockResolvedValue({ userId: 'user-123' } as any);
      vi.mocked(playbookQueries.updatePlaybook).mockResolvedValue({} as any);

      const data = {
        steps: [
          { sequence: 1, instruction: 'New step 1' },
          { sequence: 2, instruction: 'New step 2' },
          { sequence: 3, instruction: 'New step 3' },
        ],
      };

      await updatePlaybook('playbook-id', data);

      expect(playbookQueries.updatePlaybook).toHaveBeenCalledWith(
        'playbook-id',
        expect.objectContaining({
          steps: expect.arrayContaining([
            expect.objectContaining({ sequence: 1 }),
            expect.objectContaining({ sequence: 2 }),
            expect.objectContaining({ sequence: 3 }),
          ]),
        }),
      );
    });

    it('should return null when playbook not found', async () => {
      vi.mocked(auth).mockResolvedValue({ userId: 'user-123' } as any);
      vi.mocked(playbookQueries.updatePlaybook).mockResolvedValue(null);

      const result = await updatePlaybook('non-existent-id', { name: 'test' });

      expect(result).toBeNull();
    });
  });

  describe('deletePlaybook', () => {
    it('should delete a playbook when user is authenticated', async () => {
      vi.mocked(auth).mockResolvedValue({ userId: 'user-123' } as any);
      vi.mocked(playbookQueries.deletePlaybook).mockResolvedValue(true);

      const result = await deletePlaybook('playbook-id');

      expect(auth).toHaveBeenCalled();
      expect(playbookQueries.deletePlaybook).toHaveBeenCalledWith(
        'playbook-id',
      );
      expect(result).toBe(true);
    });

    it('should redirect to login when user is not authenticated', async () => {
      vi.mocked(auth).mockResolvedValue({ userId: null } as any);

      await expect(deletePlaybook('playbook-id')).rejects.toThrow(
        'NEXT_REDIRECT',
      );
      expect(redirect).toHaveBeenCalledWith('/login');
      expect(playbookQueries.deletePlaybook).not.toHaveBeenCalled();
    });

    it('should return false when playbook not found', async () => {
      vi.mocked(auth).mockResolvedValue({ userId: 'user-123' } as any);
      vi.mocked(playbookQueries.deletePlaybook).mockResolvedValue(false);

      const result = await deletePlaybook('non-existent-id');

      expect(result).toBe(false);
    });

    it('should handle cascading delete of steps', async () => {
      // Steps should be deleted automatically via database CASCADE
      vi.mocked(auth).mockResolvedValue({ userId: 'user-123' } as any);
      vi.mocked(playbookQueries.deletePlaybook).mockResolvedValue(true);

      const result = await deletePlaybook('playbook-with-steps');

      expect(result).toBe(true);
      expect(playbookQueries.deletePlaybook).toHaveBeenCalledWith(
        'playbook-with-steps',
      );
    });
  });
});
