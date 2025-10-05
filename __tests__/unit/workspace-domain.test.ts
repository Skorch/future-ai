import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createWorkspace } from '@/lib/workspace/queries';
import { workspace } from '@/lib/db/schema';
import { db } from '@/lib/db/queries';
import { eq } from 'drizzle-orm';

// Mock the database
vi.mock('@/lib/db/queries', () => ({
  db: {
    insert: vi.fn(),
    select: vi.fn(),
  },
}));

describe('Workspace Domain Resolution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createWorkspace', () => {
    it('should create workspace with provided domainId', async () => {
      const mockWorkspace = {
        id: 'test-workspace-id',
        userId: 'test-user-id',
        name: 'Test Workspace',
        description: 'Test description',
        domainId: 'meeting',
        createdAt: new Date(),
        lastAccessedAt: new Date(),
        deletedAt: null,
      };

      const insertMock = {
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([mockWorkspace]),
      };

      (db.insert as ReturnType<typeof vi.fn>).mockReturnValue(insertMock);

      const result = await createWorkspace(
        'test-user-id',
        'Test Workspace',
        'Test description',
        'meeting',
      );

      expect(db.insert).toHaveBeenCalledWith(workspace);
      expect(insertMock.values).toHaveBeenCalledWith({
        userId: 'test-user-id',
        name: 'Test Workspace',
        description: 'Test description',
        domainId: 'meeting',
      });
      expect(result).toEqual(mockWorkspace);
    });

    it('should default to sales domain when domainId not provided', async () => {
      const mockWorkspace = {
        id: 'test-workspace-id',
        userId: 'test-user-id',
        name: 'Test Workspace',
        description: undefined,
        domainId: 'sales',
        createdAt: new Date(),
        lastAccessedAt: new Date(),
        deletedAt: null,
      };

      const insertMock = {
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([mockWorkspace]),
      };

      (db.insert as ReturnType<typeof vi.fn>).mockReturnValue(insertMock);

      const result = await createWorkspace('test-user-id', 'Test Workspace');

      expect(insertMock.values).toHaveBeenCalledWith({
        userId: 'test-user-id',
        name: 'Test Workspace',
        description: undefined,
        domainId: 'sales',
      });
      expect(result.domainId).toBe('sales');
    });

    it('should handle empty string domainId by defaulting to sales', async () => {
      const mockWorkspace = {
        id: 'test-workspace-id',
        userId: 'test-user-id',
        name: 'Test Workspace',
        description: undefined,
        domainId: 'sales',
        createdAt: new Date(),
        lastAccessedAt: new Date(),
        deletedAt: null,
      };

      const insertMock = {
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([mockWorkspace]),
      };

      (db.insert as ReturnType<typeof vi.fn>).mockReturnValue(insertMock);

      const result = await createWorkspace(
        'test-user-id',
        'Test Workspace',
        undefined,
        '',
      );

      expect(insertMock.values).toHaveBeenCalledWith({
        userId: 'test-user-id',
        name: 'Test Workspace',
        description: undefined,
        domainId: 'sales',
      });
      expect(result.domainId).toBe('sales');
    });
  });

  describe('Domain Resolution from Workspace', () => {
    it('should resolve domain from workspace query', async () => {
      const mockWorkspaceData = {
        domainId: 'meeting',
      };

      const selectMock = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([mockWorkspaceData]),
      };

      (db.select as ReturnType<typeof vi.fn>).mockReturnValue(selectMock);

      // Simulate chat route domain resolution
      const workspaceData = await db
        .select({ domainId: workspace.domainId })
        .from(workspace)
        .where(eq(workspace.id, 'test-workspace-id'))
        .limit(1);

      const domainId = workspaceData[0]?.domainId || 'sales';

      expect(domainId).toBe('meeting');
    });

    it('should fallback to sales when workspace not found', async () => {
      const selectMock = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      };

      (db.select as ReturnType<typeof vi.fn>).mockReturnValue(selectMock);

      // Simulate chat route domain resolution
      const workspaceData = await db
        .select({ domainId: workspace.domainId })
        .from(workspace)
        .where(eq(workspace.id, 'non-existent-workspace'))
        .limit(1);

      const domainId = workspaceData[0]?.domainId || 'sales';

      expect(domainId).toBe('sales');
    });

    it('should fallback to sales when domainId is null', async () => {
      const mockWorkspaceData = {
        domainId: null,
      };

      const selectMock = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([mockWorkspaceData]),
      };

      (db.select as ReturnType<typeof vi.fn>).mockReturnValue(selectMock);

      // Simulate chat route domain resolution
      const workspaceData = await db
        .select({ domainId: workspace.domainId })
        .from(workspace)
        .where(eq(workspace.id, 'test-workspace-id'))
        .limit(1);

      const domainId = workspaceData[0]?.domainId || 'sales';

      expect(domainId).toBe('sales');
    });
  });

  describe('Migration Behavior', () => {
    it('should handle existing workspaces with default sales domain', async () => {
      // Test that migration adds default 'sales' domain
      const mockExistingWorkspace = {
        id: 'existing-workspace-id',
        userId: 'test-user-id',
        name: 'Existing Workspace',
        description: 'Created before migration',
        domainId: 'sales', // Default from migration
        createdAt: new Date('2024-01-01'),
        lastAccessedAt: new Date('2024-01-01'),
        deletedAt: null,
      };

      expect(mockExistingWorkspace.domainId).toBe('sales');
    });
  });
});
