import { describe, it, expect } from 'vitest';
import type { Objective } from '../objective';

describe('Objective Types', () => {
  it('should have correct type structure', () => {
    const obj: Objective = {
      id: 'test-id',
      workspaceId: 'ws-id',
      title: 'Test Objective',
      documentType: 'prd',
      status: 'open',
      createdAt: new Date(),
      updatedAt: new Date(),
      createdByUserId: 'user-id',
    };

    expect(obj.id).toBeDefined();
    expect(obj.status).toBe('open');
    expect(obj.documentType).toBe('prd');
  });

  it('should support published status', () => {
    const obj: Objective = {
      id: 'test-id',
      workspaceId: 'ws-id',
      title: 'Test Objective',
      documentType: 'proposal',
      status: 'published',
      createdAt: new Date(),
      updatedAt: new Date(),
      publishedAt: new Date(),
      createdByUserId: 'user-id',
    };

    expect(obj.status).toBe('published');
    expect(obj.publishedAt).toBeDefined();
  });

  it('should support optional fields', () => {
    const obj: Objective = {
      id: 'test-id',
      workspaceId: 'ws-id',
      objectiveDocumentId: 'doc-id', // Optional FK
      title: 'Test Objective',
      description: 'Test description', // Optional
      documentType: 'prd',
      status: 'open',
      createdAt: new Date(),
      updatedAt: new Date(),
      createdByUserId: 'user-id',
    };

    expect(obj.objectiveDocumentId).toBe('doc-id');
    expect(obj.description).toBe('Test description');
  });
});
