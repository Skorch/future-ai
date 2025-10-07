/**
 * Integration tests for Document Lifecycle Phase 3
 *
 * Tests cascade cleanup behaviors:
 * - Message edit/delete cascade
 * - Chat deletion cleanup
 * - Auto-save with/without messageId
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { db } from '@/lib/db/queries';
import {
  documentVersion,
  workspace,
  user,
  chat,
  message,
} from '@/lib/db/schema';
import {
  createDocument,
  saveDocumentDraft,
  publishDocument,
  cleanOrphanedVersions,
  getDocumentWithVersions,
} from '@/lib/db/documents';
import {
  deleteChatById,
  deleteMessagesByChatIdAfterTimestamp,
  getChatById,
} from '@/lib/db/queries';
import { eq, and, isNull } from 'drizzle-orm';

describe('Document Lifecycle Phase 3 - Integration Tests', () => {
  // Test data IDs
  let testUserId: string;
  let testWorkspaceId: string;
  let testChatId: string;
  let testMessageId1: string;
  let testMessageId2: string;

  beforeAll(async () => {
    // Create test user
    const [testUser] = await db
      .insert(user)
      .values({
        id: 'test-user-phase3',
        email: 'phase3@test.com',
        firstName: 'Phase3',
        lastName: 'Test',
      })
      .returning();
    testUserId = testUser.id;

    // Create test workspace
    const [testWorkspace] = await db
      .insert(workspace)
      .values({
        userId: testUserId,
        name: 'Phase 3 Test Workspace',
        domainId: 'sales',
      })
      .returning();
    testWorkspaceId = testWorkspace.id;
  });

  afterAll(async () => {
    // Cleanup: Delete all test data
    await db.delete(user).where(eq(user.id, testUserId));
  });

  beforeEach(async () => {
    // Create fresh chat and messages for each test
    const [testChat] = await db
      .insert(chat)
      .values({
        title: 'Phase 3 Test Chat',
        userId: testUserId,
        workspaceId: testWorkspaceId,
        createdAt: new Date(),
      })
      .returning();
    testChatId = testChat.id;

    // Create two messages (for cascade testing)
    const [msg1] = await db
      .insert(message)
      .values({
        chatId: testChatId,
        role: 'user',
        parts: [{ type: 'text', text: 'First message' }],
        attachments: [],
        createdAt: new Date(Date.now() - 1000), // 1 second ago
      })
      .returning();
    testMessageId1 = msg1.id;

    const [msg2] = await db
      .insert(message)
      .values({
        chatId: testChatId,
        role: 'assistant',
        parts: [{ type: 'text', text: 'Second message' }],
        attachments: [],
        createdAt: new Date(), // Now
      })
      .returning();
    testMessageId2 = msg2.id;
  });

  describe('Message Edit Cascade Cleanup', () => {
    it('should clean up orphaned drafts when messages are deleted', async () => {
      // Create document linked to message 2
      const doc = await createDocument({
        title: 'Test Doc',
        content: 'Initial content',
        messageId: testMessageId2,
        workspaceId: testWorkspaceId,
        userId: testUserId,
      });

      // Verify document has draft
      const beforeDelete = await getDocumentWithVersions(doc.envelope.id);
      expect(beforeDelete?.currentDraft).toBeDefined();
      expect(beforeDelete?.currentDraft?.messageId).toBe(testMessageId2);

      // Delete messages after message 1 (should delete message 2)
      await deleteMessagesByChatIdAfterTimestamp({
        chatId: testChatId,
        timestamp: new Date(Date.now() - 500), // After message 1
      });

      // Run cleanup
      const chat = await getChatById({ id: testChatId });
      if (chat) {
        await cleanOrphanedVersions(chat.workspaceId);
      }

      // Verify draft was cleaned up
      const afterCleanup = await getDocumentWithVersions(doc.envelope.id);
      expect(afterCleanup?.currentDraft).toBeNull();

      // Verify envelope still exists (defensive - don't delete envelope)
      expect(afterCleanup?.envelope).toBeDefined();
    });

    it('should preserve published versions when messages are deleted', async () => {
      // Create and publish document
      const doc = await createDocument({
        title: 'Published Doc',
        content: 'Published content',
        messageId: testMessageId2,
        workspaceId: testWorkspaceId,
        userId: testUserId,
      });

      await publishDocument(
        doc.envelope.id,
        doc.currentDraft?.id,
        true, // searchable
      );

      // Delete messages
      await deleteMessagesByChatIdAfterTimestamp({
        chatId: testChatId,
        timestamp: new Date(Date.now() - 500),
      });

      // Run cleanup
      const chat = await getChatById({ id: testChatId });
      if (chat) {
        await cleanOrphanedVersions(chat.workspaceId);
      }

      // Verify published version is preserved
      const afterCleanup = await getDocumentWithVersions(doc.envelope.id);
      expect(afterCleanup?.currentPublished).toBeDefined();
      expect(afterCleanup?.currentPublished?.content).toBe('Published content');
    });
  });

  describe('Chat Deletion Cleanup', () => {
    it('should clean up orphaned drafts when chat is deleted', async () => {
      // Create draft document in chat
      const doc = await createDocument({
        title: 'Draft in Chat',
        content: 'Draft content',
        messageId: testMessageId1,
        workspaceId: testWorkspaceId,
        userId: testUserId,
      });

      // Verify draft exists
      const beforeDelete = await getDocumentWithVersions(doc.envelope.id);
      expect(beforeDelete?.currentDraft).toBeDefined();

      // Delete chat (should trigger cleanup)
      await deleteChatById({
        id: testChatId,
        workspaceId: testWorkspaceId,
      });

      // Check if envelope was deleted (no published version, only orphaned draft)
      const orphanedVersions = await db
        .select()
        .from(documentVersion)
        .where(
          and(
            eq(documentVersion.workspaceId, testWorkspaceId),
            isNull(documentVersion.messageId),
            eq(documentVersion.isActivePublished, false),
          ),
        );

      // Should be no orphaned drafts after cleanup
      expect(orphanedVersions.length).toBe(0);
    });

    it('should preserve published documents when chat is deleted', async () => {
      // Create and publish document
      const doc = await createDocument({
        title: 'Published in Chat',
        content: 'Published content',
        messageId: testMessageId1,
        workspaceId: testWorkspaceId,
        userId: testUserId,
      });

      await publishDocument(
        doc.envelope.id,
        doc.currentDraft?.id,
        false, // not searchable
      );

      // Delete chat
      await deleteChatById({
        id: testChatId,
        workspaceId: testWorkspaceId,
      });

      // Verify published document is preserved
      const afterDelete = await getDocumentWithVersions(doc.envelope.id);
      expect(afterDelete?.currentPublished).toBeDefined();
      expect(afterDelete?.currentPublished?.messageId).toBeNull(); // Should be NULL after message deletion
    });
  });

  describe('Auto-Save Draft Management', () => {
    it('should create new draft version with messageId when provided', async () => {
      // Create initial document
      const doc = await createDocument({
        title: 'Auto-save Test',
        content: 'Initial content',
        messageId: testMessageId1,
        workspaceId: testWorkspaceId,
        userId: testUserId,
      });

      // Save draft with different messageId (simulates new edit in different message)
      const updatedVersion = await saveDocumentDraft({
        documentEnvelopeId: doc.envelope.id,
        content: 'Updated content',
        messageId: testMessageId2,
        workspaceId: testWorkspaceId,
        userId: testUserId,
      });

      // Verify new version was created
      expect(updatedVersion.versionNumber).toBe(2);
      expect(updatedVersion.messageId).toBe(testMessageId2);
      expect(updatedVersion.content).toBe('Updated content');
    });

    it('should update existing draft when messageId matches', async () => {
      // Create initial document
      const doc = await createDocument({
        title: 'Update Test',
        content: 'Initial content',
        messageId: testMessageId1,
        workspaceId: testWorkspaceId,
        userId: testUserId,
      });

      const initialVersionId = doc.currentDraft?.id;

      // Save draft with SAME messageId (simulates editing same artifact)
      const updatedVersion = await saveDocumentDraft({
        documentEnvelopeId: doc.envelope.id,
        content: 'Updated content in same message',
        messageId: testMessageId1,
        workspaceId: testWorkspaceId,
        userId: testUserId,
      });

      // Verify version was updated, not created
      expect(updatedVersion.id).toBe(initialVersionId);
      expect(updatedVersion.versionNumber).toBe(1); // Still version 1
      expect(updatedVersion.content).toBe('Updated content in same message');
    });

    it('should create standalone draft when messageId is null', async () => {
      // Create initial document
      const doc = await createDocument({
        title: 'Standalone Test',
        content: 'Initial content',
        messageId: testMessageId1,
        workspaceId: testWorkspaceId,
        userId: testUserId,
      });

      // Save draft with NULL messageId (standalone edit)
      const standaloneVersion = await saveDocumentDraft({
        documentEnvelopeId: doc.envelope.id,
        content: 'Standalone edit',
        messageId: null,
        workspaceId: testWorkspaceId,
        userId: testUserId,
      });

      // Verify standalone draft was created
      expect(standaloneVersion.versionNumber).toBe(2);
      expect(standaloneVersion.messageId).toBeNull();
      expect(standaloneVersion.content).toBe('Standalone edit');
    });
  });

  describe('Orphan Cleanup Function', () => {
    it('should only clean up orphaned unpublished drafts', async () => {
      // Create 3 documents:
      // 1. Draft with messageId (should be preserved)
      const doc1 = await createDocument({
        title: 'Draft with message',
        content: 'Content 1',
        messageId: testMessageId1,
        workspaceId: testWorkspaceId,
        userId: testUserId,
      });

      // 2. Published document with NULL messageId (should be preserved)
      const doc2 = await createDocument({
        title: 'Published orphan',
        content: 'Content 2',
        messageId: testMessageId2,
        workspaceId: testWorkspaceId,
        userId: testUserId,
      });
      await publishDocument(doc2.envelope.id, doc2.currentDraft?.id, false);

      // 3. Draft with NULL messageId (should be cleaned up)
      const doc3 = await createDocument({
        title: 'Orphaned draft',
        content: 'Content 3',
        messageId: null,
        workspaceId: testWorkspaceId,
        userId: testUserId,
      });

      // Run cleanup
      const deletedCount = await cleanOrphanedVersions(testWorkspaceId);

      // Verify only doc3 was cleaned
      expect(deletedCount).toBe(1);

      // Verify doc1 still has draft
      const check1 = await getDocumentWithVersions(doc1.envelope.id);
      expect(check1?.currentDraft).toBeDefined();

      // Verify doc2 still has published version
      const check2 = await getDocumentWithVersions(doc2.envelope.id);
      expect(check2?.currentPublished).toBeDefined();

      // Verify doc3 has no draft
      const check3 = await getDocumentWithVersions(doc3.envelope.id);
      expect(check3?.currentDraft).toBeNull();
    });
  });
});
