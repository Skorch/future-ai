import { describe, it, expect } from 'vitest';
import type {
  ObjectiveDocument,
  ObjectiveDocumentVersion,
  ObjectiveDocumentWithVersions,
} from '../objective-document';

describe('ObjectiveDocument Types', () => {
  it('should have correct ObjectiveDocument structure', () => {
    const doc: ObjectiveDocument = {
      id: 'doc-id',
      workspaceId: 'ws-id',
      title: 'Test Document',
      createdAt: new Date(),
      updatedAt: new Date(),
      createdByUserId: 'user-id',
    };

    expect(doc.id).toBeDefined();
    expect(doc.title).toBe('Test Document');
  });

  it('should have correct ObjectiveDocumentVersion structure', () => {
    const version: ObjectiveDocumentVersion = {
      id: 'version-id',
      documentId: 'doc-id',
      content: 'Test content',
      versionNumber: 1,
      createdAt: new Date(),
      createdByUserId: 'user-id',
    };

    expect(version.versionNumber).toBe(1);
    expect(version.content).toBe('Test content');
  });

  it('should support optional chatId on version', () => {
    const version: ObjectiveDocumentVersion = {
      id: 'version-id',
      documentId: 'doc-id',
      chatId: 'chat-id', // Optional
      content: 'Test content',
      metadata: { key: 'value' }, // Optional
      versionNumber: 2,
      createdAt: new Date(),
      createdByUserId: 'user-id',
    };

    expect(version.chatId).toBe('chat-id');
    expect(version.metadata).toEqual({ key: 'value' });
  });

  it('should support ObjectiveDocumentWithVersions structure', () => {
    const doc: ObjectiveDocument = {
      id: 'doc-id',
      workspaceId: 'ws-id',
      title: 'Test Document',
      createdAt: new Date(),
      updatedAt: new Date(),
      createdByUserId: 'user-id',
    };

    const version: ObjectiveDocumentVersion = {
      id: 'version-id',
      documentId: 'doc-id',
      content: 'Test content',
      versionNumber: 1,
      createdAt: new Date(),
      createdByUserId: 'user-id',
    };

    const withVersions: ObjectiveDocumentWithVersions = {
      document: doc,
      versions: [version],
      latestVersion: version,
    };

    expect(withVersions.document.id).toBe('doc-id');
    expect(withVersions.versions).toHaveLength(1);
    expect(withVersions.latestVersion?.versionNumber).toBe(1);
  });
});
