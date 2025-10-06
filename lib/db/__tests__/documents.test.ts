/**
 * Integration tests for Document Lifecycle DAL
 *
 * These tests validate the draft/publish workflow with version control.
 * Tests run against actual database (not mocks) to ensure schema integrity.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { db } from '@/lib/db/queries';
import {
  documentEnvelope,
  documentVersion,
  workspace,
  user,
  chat,
  message,
} from '@/lib/db/schema';
import { DocumentsDAL } from '@/lib/db/documents';
import { eq } from 'drizzle-orm';

describe('Document Lifecycle DAL - Integration Tests', () => {
  const dal = new DocumentsDAL();

  // Test data IDs
  let testUserId: string;
  let testWorkspaceId: string;
  let testChatId: string;
  let testMessageId: string;

  beforeAll(async () => {
    // Create test user
    const [testUser] = await db
      .insert(user)
      .values({
        id: 'test-user-lifecycle',
        email: 'lifecycle@test.com',
        firstName: 'Test',
        lastName: 'User',
      })
      .returning();
    testUserId = testUser.id;

    // Create test workspace
    const [testWorkspace] = await db
      .insert(workspace)
      .values({
        userId: testUserId,
        name: 'Test Workspace',
        domainId: 'sales',
      })
      .returning();
    testWorkspaceId = testWorkspace.id;

    // Create test chat
    const [testChat] = await db
      .insert(chat)
      .values({
        title: 'Test Chat',
        userId: testUserId,
        workspaceId: testWorkspaceId,
        createdAt: new Date(),
      })
      .returning();
    testChatId = testChat.id;

    // Create test message
    const [testMessage] = await db
      .insert(message)
      .values({
        chatId: testChatId,
        role: 'assistant',
        parts: [],
        attachments: [],
        createdAt: new Date(),
      })
      .returning();
    testMessageId = testMessage.id;
  });

  afterAll(async () => {
    // Clean up test data
    await db.delete(workspace).where(eq(workspace.userId, testUserId));
    await db.delete(user).where(eq(user.id, testUserId));
  });

  beforeEach(async () => {
    // Clean up documents before each test
    await db
      .delete(documentEnvelope)
      .where(eq(documentEnvelope.workspaceId, testWorkspaceId));
  });

  describe('createDocument', () => {
    it('should create document with envelope and initial draft version', async () => {
      const result = await dal.createDocument({
        title: 'Test Document',
        content: '# Test Content',
        messageId: testMessageId,
        chatId: testChatId,
        workspaceId: testWorkspaceId,
        userId: testUserId,
        documentType: 'meeting-notes',
        metadata: { test: true },
      });

      // Verify envelope
      expect(result.envelope.title).toBe('Test Document');
      expect(result.envelope.documentType).toBe('meeting-notes');
      expect(result.envelope.workspaceId).toBe(testWorkspaceId);
      expect(result.envelope.activeDraftVersionId).toBeTruthy();
      expect(result.envelope.activePublishedVersionId).toBeNull();
      expect(result.envelope.isSearchable).toBe(false);

      // Verify draft version
      expect(result.currentDraft).toBeTruthy();
      expect(result.currentDraft?.content).toBe('# Test Content');
      expect(result.currentDraft?.versionNumber).toBe(1);
      expect(result.currentDraft?.messageId).toBe(testMessageId);
      expect(result.currentDraft?.chatId).toBe(testChatId);

      // Verify no published version
      expect(result.currentPublished).toBeNull();

      // Verify envelope points to draft
      expect(result.envelope.activeDraftVersionId).toBe(
        result.currentDraft?.id,
      );
    });

    it('should default to text kind when not specified', async () => {
      const result = await dal.createDocument({
        title: 'Text Doc',
        content: 'Plain text',
        messageId: testMessageId,
        chatId: testChatId,
        workspaceId: testWorkspaceId,
        userId: testUserId,
      });

      expect(result.currentDraft?.kind).toBe('text');
    });
  });

  describe('saveDocumentDraft', () => {
    it('should update existing draft when editing from same chat', async () => {
      // Create initial document
      const doc = await dal.createDocument({
        title: 'Draft Test',
        content: 'Version 1',
        messageId: testMessageId,
        chatId: testChatId,
        workspaceId: testWorkspaceId,
        userId: testUserId,
      });

      const draftId = doc.currentDraft?.id;

      // Update draft from same chat
      const updated = await dal.saveDocumentDraft({
        documentEnvelopeId: doc.envelope.id,
        content: 'Version 1 Updated',
        messageId: testMessageId,
        chatId: testChatId,
        userId: testUserId,
        metadata: { updated: true },
      });

      // Should be same version ID (updated, not new)
      expect(updated.id).toBe(draftId);
      expect(updated.content).toBe('Version 1 Updated');
      expect(updated.versionNumber).toBe(1);
      expect(updated.metadata).toEqual({ updated: true });
    });

    it('should create new version when editing from different chat', async () => {
      // Create initial document
      const doc = await dal.createDocument({
        title: 'Multi-Chat Test',
        content: 'Chat 1 Version',
        messageId: testMessageId,
        chatId: testChatId,
        workspaceId: testWorkspaceId,
        userId: testUserId,
      });

      // Create second chat
      const [chat2] = await db
        .insert(chat)
        .values({
          title: 'Test Chat 2',
          userId: testUserId,
          workspaceId: testWorkspaceId,
          createdAt: new Date(),
        })
        .returning();

      const [message2] = await db
        .insert(message)
        .values({
          chatId: chat2.id,
          role: 'assistant',
          parts: [],
          attachments: [],
          createdAt: new Date(),
        })
        .returning();

      // Update from different chat
      const newVersion = await dal.saveDocumentDraft({
        documentEnvelopeId: doc.envelope.id,
        content: 'Chat 2 Version',
        messageId: message2.id,
        chatId: chat2.id,
        userId: testUserId,
      });

      // Should be new version
      expect(newVersion.id).not.toBe(doc.currentDraft?.id);
      expect(newVersion.versionNumber).toBe(2);
      expect(newVersion.content).toBe('Chat 2 Version');
      expect(newVersion.chatId).toBe(chat2.id);
    });
  });

  describe('publishDocument', () => {
    it('should publish draft version and make searchable', async () => {
      // Create draft
      const doc = await dal.createDocument({
        title: 'Publish Test',
        content: 'Draft content',
        messageId: testMessageId,
        chatId: testChatId,
        workspaceId: testWorkspaceId,
        userId: testUserId,
      });

      // Publish it
      await dal.publishDocument(doc.envelope.id, doc.currentDraft?.id, true);

      // Verify published state
      const published = await dal.getDocumentWithVersions(doc.envelope.id);
      expect(published?.envelope.activePublishedVersionId).toBe(
        doc.currentDraft?.id,
      );
      expect(published?.envelope.isSearchable).toBe(true);
      expect(published?.currentPublished?.id).toBe(doc.currentDraft?.id);
    });

    it('should publish without making searchable', async () => {
      const doc = await dal.createDocument({
        title: 'Non-Searchable Publish',
        content: 'Content',
        messageId: testMessageId,
        chatId: testChatId,
        workspaceId: testWorkspaceId,
        userId: testUserId,
      });

      await dal.publishDocument(doc.envelope.id, doc.currentDraft?.id, false);

      const published = await dal.getDocumentWithVersions(doc.envelope.id);
      expect(published?.envelope.activePublishedVersionId).toBe(
        doc.currentDraft?.id,
      );
      expect(published?.envelope.isSearchable).toBe(false);
    });
  });

  describe('unpublishDocument', () => {
    it('should unpublish document and clear searchable flag', async () => {
      // Create and publish
      const doc = await dal.createDocument({
        title: 'Unpublish Test',
        content: 'Content',
        messageId: testMessageId,
        chatId: testChatId,
        workspaceId: testWorkspaceId,
        userId: testUserId,
      });

      await dal.publishDocument(doc.envelope.id, doc.currentDraft?.id, true);

      // Unpublish
      await dal.unpublishDocument(doc.envelope.id);

      // Verify unpublished
      const unpublished = await dal.getDocumentWithVersions(doc.envelope.id);
      expect(unpublished?.envelope.activePublishedVersionId).toBeNull();
      expect(unpublished?.envelope.isSearchable).toBe(false);
    });
  });

  describe('getPublishedDocuments', () => {
    it('should return only published documents', async () => {
      // Create published document
      const doc1 = await dal.createDocument({
        title: 'Published Doc',
        content: 'Content',
        messageId: testMessageId,
        chatId: testChatId,
        workspaceId: testWorkspaceId,
        userId: testUserId,
      });
      await dal.publishDocument(doc1.envelope.id, doc1.currentDraft?.id, true);

      // Create draft-only document
      await dal.createDocument({
        title: 'Draft Only',
        content: 'Content',
        messageId: testMessageId,
        chatId: testChatId,
        workspaceId: testWorkspaceId,
        userId: testUserId,
      });

      // Query published
      const published = await dal.getPublishedDocuments(testWorkspaceId);

      expect(published).toHaveLength(1);
      expect(published[0].envelope.title).toBe('Published Doc');
      expect(published[0].currentPublished).toBeTruthy();
      expect(published[0].currentDraft).toBeNull(); // Drafts not exposed in list
    });
  });

  describe('getDraftCountByChat', () => {
    it('should count unpublished drafts in chat', async () => {
      // Create draft document
      await dal.createDocument({
        title: 'Draft 1',
        content: 'Content',
        messageId: testMessageId,
        chatId: testChatId,
        workspaceId: testWorkspaceId,
        userId: testUserId,
      });

      // Create published document (should not count)
      const doc2 = await dal.createDocument({
        title: 'Published',
        content: 'Content',
        messageId: testMessageId,
        chatId: testChatId,
        workspaceId: testWorkspaceId,
        userId: testUserId,
      });
      await dal.publishDocument(doc2.envelope.id, doc2.currentDraft?.id, false);

      const count = await dal.getDraftCountByChat(testChatId);
      expect(count).toBe(1); // Only Draft 1
    });
  });

  describe('toggleDocumentSearchable', () => {
    it('should toggle searchable flag', async () => {
      // Create and publish without searchable
      const doc = await dal.createDocument({
        title: 'Toggle Test',
        content: 'Content',
        messageId: testMessageId,
        chatId: testChatId,
        workspaceId: testWorkspaceId,
        userId: testUserId,
      });
      await dal.publishDocument(doc.envelope.id, doc.currentDraft?.id, false);

      // Toggle to searchable
      const isSearchable = await dal.toggleDocumentSearchable(doc.envelope.id);
      expect(isSearchable).toBe(true);

      // Toggle back
      const isNotSearchable = await dal.toggleDocumentSearchable(
        doc.envelope.id,
      );
      expect(isNotSearchable).toBe(false);
    });

    it('should throw error if document not published', async () => {
      const doc = await dal.createDocument({
        title: 'Not Published',
        content: 'Content',
        messageId: testMessageId,
        chatId: testChatId,
        workspaceId: testWorkspaceId,
        userId: testUserId,
      });

      await expect(
        dal.toggleDocumentSearchable(doc.envelope.id),
      ).rejects.toThrow('Document not found or not published');
    });
  });

  describe('getOrCreateStandaloneDraft', () => {
    it('should create standalone draft from published version', async () => {
      // Create and publish
      const doc = await dal.createDocument({
        title: 'Standalone Test',
        content: 'Published Content',
        messageId: testMessageId,
        chatId: testChatId,
        workspaceId: testWorkspaceId,
        userId: testUserId,
      });
      await dal.publishDocument(doc.envelope.id, doc.currentDraft?.id, false);

      // Create standalone draft
      const standaloneDraft = await dal.getOrCreateStandaloneDraft(
        doc.envelope.id,
        testUserId,
      );

      expect(standaloneDraft.chatId).toBeNull();
      expect(standaloneDraft.messageId).toBeNull();
      expect(standaloneDraft.content).toBe('Published Content');
      expect(standaloneDraft.versionNumber).toBe(2);
    });

    it('should reuse existing standalone draft', async () => {
      // Create and publish
      const doc = await dal.createDocument({
        title: 'Reuse Test',
        content: 'Content',
        messageId: testMessageId,
        chatId: testChatId,
        workspaceId: testWorkspaceId,
        userId: testUserId,
      });
      await dal.publishDocument(doc.envelope.id, doc.currentDraft?.id, false);

      // Create standalone draft
      const draft1 = await dal.getOrCreateStandaloneDraft(
        doc.envelope.id,
        testUserId,
      );

      // Call again - should return same draft
      const draft2 = await dal.getOrCreateStandaloneDraft(
        doc.envelope.id,
        testUserId,
      );

      expect(draft1.id).toBe(draft2.id);
    });

    it('should throw error if no published version exists', async () => {
      const doc = await dal.createDocument({
        title: 'No Published',
        content: 'Content',
        messageId: testMessageId,
        chatId: testChatId,
        workspaceId: testWorkspaceId,
        userId: testUserId,
      });

      await expect(
        dal.getOrCreateStandaloneDraft(doc.envelope.id, testUserId),
      ).rejects.toThrow('Cannot create draft - no published version exists');
    });
  });

  describe('hasUnpublishedDraft', () => {
    it('should return true when draft differs from published', async () => {
      // Create and publish
      const doc = await dal.createDocument({
        title: 'Has Draft Test',
        content: 'Version 1',
        messageId: testMessageId,
        chatId: testChatId,
        workspaceId: testWorkspaceId,
        userId: testUserId,
      });
      await dal.publishDocument(doc.envelope.id, doc.currentDraft?.id, false);

      // Create new draft
      await dal.saveDocumentDraft({
        documentEnvelopeId: doc.envelope.id,
        content: 'Version 2',
        messageId: testMessageId,
        chatId: testChatId,
        userId: testUserId,
      });

      const hasDraft = await dal.hasUnpublishedDraft(doc.envelope.id);
      expect(hasDraft).toBe(true);
    });

    it('should return false when no unpublished changes', async () => {
      const doc = await dal.createDocument({
        title: 'No Draft Test',
        content: 'Content',
        messageId: testMessageId,
        chatId: testChatId,
        workspaceId: testWorkspaceId,
        userId: testUserId,
      });
      await dal.publishDocument(doc.envelope.id, doc.currentDraft?.id, false);

      const hasDraft = await dal.hasUnpublishedDraft(doc.envelope.id);
      expect(hasDraft).toBe(false);
    });
  });

  describe('discardStandaloneDraft', () => {
    it('should delete standalone draft', async () => {
      // Create and publish
      const doc = await dal.createDocument({
        title: 'Discard Test',
        content: 'Published',
        messageId: testMessageId,
        chatId: testChatId,
        workspaceId: testWorkspaceId,
        userId: testUserId,
      });
      await dal.publishDocument(doc.envelope.id, doc.currentDraft?.id, false);

      // Create standalone draft
      await dal.getOrCreateStandaloneDraft(doc.envelope.id, testUserId);

      // Verify draft exists
      let hasDraft = await dal.hasUnpublishedDraft(doc.envelope.id);
      expect(hasDraft).toBe(true);

      // Discard draft
      await dal.discardStandaloneDraft(doc.envelope.id);

      // Verify draft removed
      hasDraft = await dal.hasUnpublishedDraft(doc.envelope.id);
      expect(hasDraft).toBe(false);

      // Verify envelope still points to published
      const result = await dal.getDocumentWithVersions(doc.envelope.id);
      expect(result?.envelope.activePublishedVersionId).toBeTruthy();
      expect(result?.envelope.activeDraftVersionId).toBeNull();
    });
  });

  describe('Cascade Delete Behavior', () => {
    it('should preserve published version when chat is deleted', async () => {
      // Create and publish
      const doc = await dal.createDocument({
        title: 'Cascade Test',
        content: 'Content',
        messageId: testMessageId,
        chatId: testChatId,
        workspaceId: testWorkspaceId,
        userId: testUserId,
      });
      await dal.publishDocument(doc.envelope.id, doc.currentDraft?.id, true);

      const publishedVersionId = doc.currentDraft?.id;

      // Delete chat (cascade should handle versions)
      await db.delete(chat).where(eq(chat.id, testChatId));

      // Verify envelope still exists
      const result = await dal.getDocumentWithVersions(doc.envelope.id);
      expect(result).toBeTruthy();

      // Verify published version still exists
      const versions = await db
        .select()
        .from(documentVersion)
        .where(eq(documentVersion.id, publishedVersionId));

      expect(versions).toHaveLength(1);
      expect(versions[0].messageId).toBeNull(); // FK cleared
      expect(versions[0].chatId).toBeNull(); // FK cleared
    });
  });
});
