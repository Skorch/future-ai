import { describe, it, expect } from 'vitest';
import type {
  KnowledgeDocument,
  KnowledgeCategory,
} from '../knowledge-document';

describe('KnowledgeDocument Types', () => {
  it('should have correct type structure', () => {
    const doc: KnowledgeDocument = {
      id: 'knowledge-id',
      workspaceId: 'ws-id',
      title: 'Test Knowledge',
      content: 'Test content',
      category: 'knowledge',
      documentType: 'text',
      isSearchable: true,
      createdAt: new Date(),
      createdByUserId: 'user-id',
    };

    expect(doc.id).toBeDefined();
    expect(doc.category).toBe('knowledge');
    expect(doc.isSearchable).toBe(true);
  });

  it('should support raw category', () => {
    const doc: KnowledgeDocument = {
      id: 'raw-id',
      workspaceId: 'ws-id',
      title: 'Raw Data',
      content: 'Raw content',
      category: 'raw',
      documentType: 'text',
      isSearchable: false,
      createdAt: new Date(),
      createdByUserId: 'user-id',
    };

    expect(doc.category).toBe('raw');
    expect(doc.isSearchable).toBe(false);
  });

  it('should support optional fields', () => {
    const doc: KnowledgeDocument = {
      id: 'knowledge-id',
      objectiveId: 'obj-id', // Optional
      workspaceId: 'ws-id',
      title: 'Test Knowledge',
      content: 'Test content',
      category: 'knowledge',
      documentType: 'meeting-analysis',
      isSearchable: true,
      metadata: { source: 'upload' }, // Optional
      createdAt: new Date(),
      createdByUserId: 'user-id',
    };

    expect(doc.objectiveId).toBe('obj-id');
    expect(doc.metadata).toEqual({ source: 'upload' });
    expect(doc.documentType).toBe('meeting-analysis');
  });

  it('should enforce KnowledgeCategory type', () => {
    const validCategories: KnowledgeCategory[] = ['knowledge', 'raw'];

    validCategories.forEach((category) => {
      const doc: KnowledgeDocument = {
        id: 'test-id',
        workspaceId: 'ws-id',
        title: 'Test',
        content: 'Content',
        category,
        documentType: 'text',
        isSearchable: true,
        createdAt: new Date(),
        createdByUserId: 'user-id',
      };

      expect(['knowledge', 'raw']).toContain(doc.category);
    });
  });
});
