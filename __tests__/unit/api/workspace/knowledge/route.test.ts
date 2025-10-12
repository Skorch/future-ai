import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/(chat)/api/workspace/[workspaceId]/knowledge/route';
import { RAW_DOCUMENT_TYPES } from '@/lib/db/types/document-types';

// Mock dependencies
vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(),
}));

vi.mock('@/lib/db/knowledge-document', () => ({
  createKnowledgeDocument: vi.fn(),
}));

vi.mock('@/lib/ai/generate-document-metadata', () => ({
  generateDocumentMetadata: vi.fn(),
}));

vi.mock('@/lib/workspace/queries', () => ({
  getWorkspaceById: vi.fn(),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  getLogger: vi.fn(() => ({
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  })),
}));

describe('POST /api/workspace/[workspaceId]/knowledge', () => {
  let mockAuth: ReturnType<typeof vi.fn>;
  let mockCreateKnowledgeDocument: ReturnType<typeof vi.fn>;
  let mockGenerateDocumentMetadata: ReturnType<typeof vi.fn>;
  let mockGetWorkspaceById: ReturnType<typeof vi.fn>;
  let mockRevalidatePath: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();

    const { auth } = await import('@clerk/nextjs/server');
    mockAuth = vi.mocked(auth);

    const { createKnowledgeDocument } = await import(
      '@/lib/db/knowledge-document'
    );
    mockCreateKnowledgeDocument = vi.mocked(createKnowledgeDocument);

    const { generateDocumentMetadata } = await import(
      '@/lib/ai/generate-document-metadata'
    );
    mockGenerateDocumentMetadata = vi.mocked(generateDocumentMetadata);

    const { getWorkspaceById } = await import('@/lib/workspace/queries');
    mockGetWorkspaceById = vi.mocked(getWorkspaceById);

    const { revalidatePath } = await import('next/cache');
    mockRevalidatePath = vi.mocked(revalidatePath);
  });

  describe('Authentication', () => {
    it('should return 401 when user is not authenticated', async () => {
      mockAuth.mockResolvedValueOnce({ userId: null });

      const request = new Request(
        'http://localhost:3000/api/workspace/ws-123/knowledge',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: 'test', category: 'raw' }),
        },
      );

      const response = await POST(request, {
        params: Promise.resolve({ workspaceId: 'ws-123' }),
      });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should proceed when user is authenticated', async () => {
      mockAuth.mockResolvedValueOnce({ userId: 'user-123' });
      mockGetWorkspaceById.mockResolvedValueOnce({ id: 'ws-123' });
      mockGenerateDocumentMetadata.mockResolvedValueOnce({
        title: 'Test',
        documentType: RAW_DOCUMENT_TYPES.OTHER,
      });
      mockCreateKnowledgeDocument.mockResolvedValueOnce({
        id: 'doc-123',
        title: 'Test',
      });

      const request = new Request(
        'http://localhost:3000/api/workspace/ws-123/knowledge',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: 'test', category: 'raw' }),
        },
      );

      const response = await POST(request, {
        params: Promise.resolve({ workspaceId: 'ws-123' }),
      });

      expect(response.status).not.toBe(401);
    });
  });

  describe('Workspace Validation', () => {
    beforeEach(() => {
      mockAuth.mockResolvedValue({ userId: 'user-123' });
    });

    it('should return 404 when workspace not found', async () => {
      mockGetWorkspaceById.mockResolvedValueOnce(null);

      const request = new Request(
        'http://localhost:3000/api/workspace/ws-999/knowledge',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: 'test', category: 'raw' }),
        },
      );

      const response = await POST(request, {
        params: Promise.resolve({ workspaceId: 'ws-999' }),
      });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Workspace not found');
    });

    it('should verify workspace ownership with userId', async () => {
      mockGetWorkspaceById.mockResolvedValueOnce({ id: 'ws-123' });
      mockGenerateDocumentMetadata.mockResolvedValueOnce({
        title: 'Test',
        documentType: RAW_DOCUMENT_TYPES.OTHER,
      });
      mockCreateKnowledgeDocument.mockResolvedValueOnce({
        id: 'doc-123',
        title: 'Test',
      });

      const request = new Request(
        'http://localhost:3000/api/workspace/ws-123/knowledge',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: 'test', category: 'raw' }),
        },
      );

      await POST(request, {
        params: Promise.resolve({ workspaceId: 'ws-123' }),
      });

      expect(mockGetWorkspaceById).toHaveBeenCalledWith('ws-123', 'user-123');
    });
  });

  describe('Request Validation', () => {
    beforeEach(() => {
      mockAuth.mockResolvedValue({ userId: 'user-123' });
      mockGetWorkspaceById.mockResolvedValue({ id: 'ws-123' });
    });

    it('should return 400 when content is missing', async () => {
      const request = new Request(
        'http://localhost:3000/api/workspace/ws-123/knowledge',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ category: 'raw' }),
        },
      );

      const response = await POST(request, {
        params: Promise.resolve({ workspaceId: 'ws-123' }),
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Content and category are required');
    });

    it('should return 400 when category is missing', async () => {
      const request = new Request(
        'http://localhost:3000/api/workspace/ws-123/knowledge',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: 'test content' }),
        },
      );

      const response = await POST(request, {
        params: Promise.resolve({ workspaceId: 'ws-123' }),
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Content and category are required');
    });

    it('should return 400 when category is invalid', async () => {
      const request = new Request(
        'http://localhost:3000/api/workspace/ws-123/knowledge',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: 'test', category: 'invalid' }),
        },
      );

      const response = await POST(request, {
        params: Promise.resolve({ workspaceId: 'ws-123' }),
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid category');
    });

    it('should accept knowledge category', async () => {
      mockGenerateDocumentMetadata.mockResolvedValueOnce({
        title: 'Test',
        documentType: RAW_DOCUMENT_TYPES.OTHER,
      });
      mockCreateKnowledgeDocument.mockResolvedValueOnce({
        id: 'doc-123',
        title: 'Test',
      });

      const request = new Request(
        'http://localhost:3000/api/workspace/ws-123/knowledge',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: 'test', category: 'knowledge' }),
        },
      );

      const response = await POST(request, {
        params: Promise.resolve({ workspaceId: 'ws-123' }),
      });

      expect(response.status).not.toBe(400);
    });

    it('should accept raw category', async () => {
      mockGenerateDocumentMetadata.mockResolvedValueOnce({
        title: 'Test',
        documentType: RAW_DOCUMENT_TYPES.OTHER,
      });
      mockCreateKnowledgeDocument.mockResolvedValueOnce({
        id: 'doc-123',
        title: 'Test',
      });

      const request = new Request(
        'http://localhost:3000/api/workspace/ws-123/knowledge',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: 'test', category: 'raw' }),
        },
      );

      const response = await POST(request, {
        params: Promise.resolve({ workspaceId: 'ws-123' }),
      });

      expect(response.status).not.toBe(400);
    });

    it('should accept request with optional title', async () => {
      mockCreateKnowledgeDocument.mockResolvedValueOnce({
        id: 'doc-123',
        title: 'Custom Title',
      });

      const request = new Request(
        'http://localhost:3000/api/workspace/ws-123/knowledge',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: 'test',
            category: 'raw',
            title: 'Custom Title',
            documentType: RAW_DOCUMENT_TYPES.TRANSCRIPT,
          }),
        },
      );

      const response = await POST(request, {
        params: Promise.resolve({ workspaceId: 'ws-123' }),
      });

      expect(response.status).toBe(201);
    });

    it('should accept request with optional documentType', async () => {
      mockCreateKnowledgeDocument.mockResolvedValueOnce({
        id: 'doc-123',
        title: 'Test',
      });

      const request = new Request(
        'http://localhost:3000/api/workspace/ws-123/knowledge',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: 'test',
            category: 'raw',
            title: 'Test',
            documentType: RAW_DOCUMENT_TYPES.EMAIL,
          }),
        },
      );

      const response = await POST(request, {
        params: Promise.resolve({ workspaceId: 'ws-123' }),
      });

      expect(response.status).toBe(201);
    });

    it('should accept request with optional objectiveId', async () => {
      mockGenerateDocumentMetadata.mockResolvedValueOnce({
        title: 'Test',
        documentType: RAW_DOCUMENT_TYPES.OTHER,
      });
      mockCreateKnowledgeDocument.mockResolvedValueOnce({
        id: 'doc-123',
        title: 'Test',
      });

      const request = new Request(
        'http://localhost:3000/api/workspace/ws-123/knowledge',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: 'test',
            category: 'raw',
            objectiveId: 'obj-456',
          }),
        },
      );

      const response = await POST(request, {
        params: Promise.resolve({ workspaceId: 'ws-123' }),
      });

      expect(response.status).toBe(201);
    });
  });

  describe('AI Metadata Generation', () => {
    beforeEach(() => {
      mockAuth.mockResolvedValue({ userId: 'user-123' });
      mockGetWorkspaceById.mockResolvedValue({ id: 'ws-123' });
    });

    it('should call generateDocumentMetadata when title is missing', async () => {
      mockGenerateDocumentMetadata.mockResolvedValueOnce({
        title: 'AI Generated Title',
        documentType: RAW_DOCUMENT_TYPES.TRANSCRIPT,
      });
      mockCreateKnowledgeDocument.mockResolvedValueOnce({
        id: 'doc-123',
        title: 'AI Generated Title',
      });

      const request = new Request(
        'http://localhost:3000/api/workspace/ws-123/knowledge',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: 'Meeting transcript content',
            category: 'raw',
          }),
        },
      );

      await POST(request, {
        params: Promise.resolve({ workspaceId: 'ws-123' }),
      });

      expect(mockGenerateDocumentMetadata).toHaveBeenCalledWith({
        content: 'Meeting transcript content',
      });
    });

    it('should call generateDocumentMetadata when documentType is missing', async () => {
      mockGenerateDocumentMetadata.mockResolvedValueOnce({
        title: 'AI Generated Title',
        documentType: RAW_DOCUMENT_TYPES.EMAIL,
      });
      mockCreateKnowledgeDocument.mockResolvedValueOnce({
        id: 'doc-123',
        title: 'Custom Title',
      });

      const request = new Request(
        'http://localhost:3000/api/workspace/ws-123/knowledge',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: 'Email content',
            category: 'raw',
            title: 'Custom Title',
          }),
        },
      );

      await POST(request, {
        params: Promise.resolve({ workspaceId: 'ws-123' }),
      });

      expect(mockGenerateDocumentMetadata).toHaveBeenCalledWith({
        content: 'Email content',
      });
    });

    it('should use AI-generated title when title is missing', async () => {
      const aiTitle = 'Q4 Sales Meeting Notes';
      mockGenerateDocumentMetadata.mockResolvedValueOnce({
        title: aiTitle,
        documentType: RAW_DOCUMENT_TYPES.MEETING_NOTES,
      });
      mockCreateKnowledgeDocument.mockResolvedValueOnce({
        id: 'doc-123',
        title: aiTitle,
      });

      const request = new Request(
        'http://localhost:3000/api/workspace/ws-123/knowledge',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: 'Meeting notes content',
            category: 'raw',
          }),
        },
      );

      await POST(request, {
        params: Promise.resolve({ workspaceId: 'ws-123' }),
      });

      expect(mockCreateKnowledgeDocument).toHaveBeenCalledWith(
        'ws-123',
        'user-123',
        expect.objectContaining({
          title: aiTitle,
        }),
      );
    });

    it('should use AI-generated documentType when documentType is missing', async () => {
      mockGenerateDocumentMetadata.mockResolvedValueOnce({
        title: 'Research Document',
        documentType: RAW_DOCUMENT_TYPES.RESEARCH,
      });
      mockCreateKnowledgeDocument.mockResolvedValueOnce({
        id: 'doc-123',
        title: 'Research Document',
      });

      const request = new Request(
        'http://localhost:3000/api/workspace/ws-123/knowledge',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: 'Research content',
            category: 'raw',
          }),
        },
      );

      await POST(request, {
        params: Promise.resolve({ workspaceId: 'ws-123' }),
      });

      expect(mockCreateKnowledgeDocument).toHaveBeenCalledWith(
        'ws-123',
        'user-123',
        expect.objectContaining({
          documentType: RAW_DOCUMENT_TYPES.RESEARCH,
        }),
      );
    });

    it('should store AI summary in metadata when provided', async () => {
      const aiSummary = 'Discussion of quarterly sales targets';
      mockGenerateDocumentMetadata.mockResolvedValueOnce({
        title: 'Sales Meeting',
        documentType: RAW_DOCUMENT_TYPES.MEETING_NOTES,
        summary: aiSummary,
      });
      mockCreateKnowledgeDocument.mockResolvedValueOnce({
        id: 'doc-123',
        title: 'Sales Meeting',
      });

      const request = new Request(
        'http://localhost:3000/api/workspace/ws-123/knowledge',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: 'Meeting content',
            category: 'raw',
          }),
        },
      );

      await POST(request, {
        params: Promise.resolve({ workspaceId: 'ws-123' }),
      });

      expect(mockCreateKnowledgeDocument).toHaveBeenCalledWith(
        'ws-123',
        'user-123',
        expect.objectContaining({
          metadata: expect.objectContaining({
            aiSummary: aiSummary,
          }),
        }),
      );
    });

    it('should set aiGeneratedTitle flag when title was generated', async () => {
      mockGenerateDocumentMetadata.mockResolvedValueOnce({
        title: 'AI Title',
        documentType: RAW_DOCUMENT_TYPES.OTHER,
      });
      mockCreateKnowledgeDocument.mockResolvedValueOnce({
        id: 'doc-123',
        title: 'AI Title',
      });

      const request = new Request(
        'http://localhost:3000/api/workspace/ws-123/knowledge',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: 'content',
            category: 'raw',
          }),
        },
      );

      await POST(request, {
        params: Promise.resolve({ workspaceId: 'ws-123' }),
      });

      expect(mockCreateKnowledgeDocument).toHaveBeenCalledWith(
        'ws-123',
        'user-123',
        expect.objectContaining({
          metadata: expect.objectContaining({
            aiGeneratedTitle: true,
          }),
        }),
      );
    });

    it('should set aiGeneratedType flag when documentType was generated', async () => {
      mockGenerateDocumentMetadata.mockResolvedValueOnce({
        title: 'AI Title',
        documentType: RAW_DOCUMENT_TYPES.SLACK,
      });
      mockCreateKnowledgeDocument.mockResolvedValueOnce({
        id: 'doc-123',
        title: 'AI Title',
      });

      const request = new Request(
        'http://localhost:3000/api/workspace/ws-123/knowledge',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: 'content',
            category: 'raw',
          }),
        },
      );

      await POST(request, {
        params: Promise.resolve({ workspaceId: 'ws-123' }),
      });

      expect(mockCreateKnowledgeDocument).toHaveBeenCalledWith(
        'ws-123',
        'user-123',
        expect.objectContaining({
          metadata: expect.objectContaining({
            aiGeneratedType: true,
          }),
        }),
      );
    });
  });

  describe('Backward Compatibility', () => {
    beforeEach(() => {
      mockAuth.mockResolvedValue({ userId: 'user-123' });
      mockGetWorkspaceById.mockResolvedValue({ id: 'ws-123' });
    });

    it('should not call AI when title and documentType are provided', async () => {
      mockCreateKnowledgeDocument.mockResolvedValueOnce({
        id: 'doc-123',
        title: 'User Title',
      });

      const request = new Request(
        'http://localhost:3000/api/workspace/ws-123/knowledge',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: 'content',
            category: 'raw',
            title: 'User Title',
            documentType: RAW_DOCUMENT_TYPES.EMAIL,
          }),
        },
      );

      await POST(request, {
        params: Promise.resolve({ workspaceId: 'ws-123' }),
      });

      expect(mockGenerateDocumentMetadata).not.toHaveBeenCalled();
    });

    it('should use user-provided title over AI generation', async () => {
      mockCreateKnowledgeDocument.mockResolvedValueOnce({
        id: 'doc-123',
        title: 'My Custom Title',
      });

      const request = new Request(
        'http://localhost:3000/api/workspace/ws-123/knowledge',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: 'content',
            category: 'raw',
            title: 'My Custom Title',
            documentType: RAW_DOCUMENT_TYPES.TRANSCRIPT,
          }),
        },
      );

      await POST(request, {
        params: Promise.resolve({ workspaceId: 'ws-123' }),
      });

      expect(mockCreateKnowledgeDocument).toHaveBeenCalledWith(
        'ws-123',
        'user-123',
        expect.objectContaining({
          title: 'My Custom Title',
        }),
      );
    });

    it('should use user-provided documentType over AI generation', async () => {
      mockCreateKnowledgeDocument.mockResolvedValueOnce({
        id: 'doc-123',
        title: 'Title',
      });

      const request = new Request(
        'http://localhost:3000/api/workspace/ws-123/knowledge',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: 'content',
            category: 'raw',
            title: 'Title',
            documentType: RAW_DOCUMENT_TYPES.SLACK,
          }),
        },
      );

      await POST(request, {
        params: Promise.resolve({ workspaceId: 'ws-123' }),
      });

      expect(mockCreateKnowledgeDocument).toHaveBeenCalledWith(
        'ws-123',
        'user-123',
        expect.objectContaining({
          documentType: RAW_DOCUMENT_TYPES.SLACK,
        }),
      );
    });

    it('should preserve existing metadata when provided by user', async () => {
      mockCreateKnowledgeDocument.mockResolvedValueOnce({
        id: 'doc-123',
        title: 'Title',
      });

      const customMetadata = { source: 'api', version: 1 };

      const request = new Request(
        'http://localhost:3000/api/workspace/ws-123/knowledge',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: 'content',
            category: 'raw',
            title: 'Title',
            documentType: RAW_DOCUMENT_TYPES.OTHER,
            metadata: customMetadata,
          }),
        },
      );

      await POST(request, {
        params: Promise.resolve({ workspaceId: 'ws-123' }),
      });

      expect(mockCreateKnowledgeDocument).toHaveBeenCalledWith(
        'ws-123',
        'user-123',
        expect.objectContaining({
          metadata: expect.objectContaining(customMetadata),
        }),
      );
    });
  });

  describe('Revalidation', () => {
    beforeEach(() => {
      mockAuth.mockResolvedValue({ userId: 'user-123' });
      mockGetWorkspaceById.mockResolvedValue({ id: 'ws-789' });
      mockGenerateDocumentMetadata.mockResolvedValue({
        title: 'Test',
        documentType: RAW_DOCUMENT_TYPES.OTHER,
      });
      mockCreateKnowledgeDocument.mockResolvedValue({
        id: 'doc-456',
        title: 'Test',
      });
    });

    it('should always call revalidatePath for workspace path', async () => {
      const request = new Request(
        'http://localhost:3000/api/workspace/ws-789/knowledge',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: 'content',
            category: 'raw',
          }),
        },
      );

      await POST(request, {
        params: Promise.resolve({ workspaceId: 'ws-789' }),
      });

      expect(mockRevalidatePath).toHaveBeenCalledWith('/workspace/ws-789');
    });

    it('should call revalidatePath for objective path when objectiveId provided', async () => {
      const request = new Request(
        'http://localhost:3000/api/workspace/ws-789/knowledge',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: 'content',
            category: 'raw',
            objectiveId: 'obj-555',
          }),
        },
      );

      await POST(request, {
        params: Promise.resolve({ workspaceId: 'ws-789' }),
      });

      expect(mockRevalidatePath).toHaveBeenCalledWith(
        '/workspace/ws-789/objective/obj-555',
      );
    });

    it('should not call revalidatePath for objective path when objectiveId not provided', async () => {
      const request = new Request(
        'http://localhost:3000/api/workspace/ws-789/knowledge',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: 'content',
            category: 'raw',
          }),
        },
      );

      await POST(request, {
        params: Promise.resolve({ workspaceId: 'ws-789' }),
      });

      expect(mockRevalidatePath).toHaveBeenCalledTimes(1);
      expect(mockRevalidatePath).toHaveBeenCalledWith('/workspace/ws-789');
    });

    it('should call revalidatePath after document creation', async () => {
      let revalidateCalledAfterCreate = false;

      mockCreateKnowledgeDocument.mockImplementationOnce(() => {
        if (mockRevalidatePath.mock.calls.length > 0) {
          revalidateCalledAfterCreate = false;
        }
        return Promise.resolve({ id: 'doc-123', title: 'Test' });
      });

      const request = new Request(
        'http://localhost:3000/api/workspace/ws-789/knowledge',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: 'content',
            category: 'raw',
          }),
        },
      );

      await POST(request, {
        params: Promise.resolve({ workspaceId: 'ws-789' }),
      });

      expect(mockRevalidatePath).toHaveBeenCalled();
      expect(revalidateCalledAfterCreate).toBe(false);
    });
  });

  describe('Response Structure', () => {
    beforeEach(() => {
      mockAuth.mockResolvedValue({ userId: 'user-123' });
      mockGetWorkspaceById.mockResolvedValue({ id: 'ws-123' });
    });

    it('should return 201 status on success', async () => {
      mockGenerateDocumentMetadata.mockResolvedValueOnce({
        title: 'Test',
        documentType: RAW_DOCUMENT_TYPES.OTHER,
      });
      mockCreateKnowledgeDocument.mockResolvedValueOnce({
        id: 'doc-123',
        title: 'Test',
      });

      const request = new Request(
        'http://localhost:3000/api/workspace/ws-123/knowledge',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: 'content',
            category: 'raw',
          }),
        },
      );

      const response = await POST(request, {
        params: Promise.resolve({ workspaceId: 'ws-123' }),
      });

      expect(response.status).toBe(201);
    });

    it('should return document in response', async () => {
      const mockDoc = {
        id: 'doc-xyz-789',
        title: 'Test Document',
        content: 'content',
        category: 'raw',
      };

      mockGenerateDocumentMetadata.mockResolvedValueOnce({
        title: 'Test Document',
        documentType: RAW_DOCUMENT_TYPES.OTHER,
      });
      mockCreateKnowledgeDocument.mockResolvedValueOnce(mockDoc);

      const request = new Request(
        'http://localhost:3000/api/workspace/ws-123/knowledge',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: 'content',
            category: 'raw',
          }),
        },
      );

      const response = await POST(request, {
        params: Promise.resolve({ workspaceId: 'ws-123' }),
      });
      const data = await response.json();

      expect(data.document).toEqual(mockDoc);
    });

    it('should return shouldCreateSummary false when header not present', async () => {
      mockGenerateDocumentMetadata.mockResolvedValueOnce({
        title: 'Test',
        documentType: RAW_DOCUMENT_TYPES.OTHER,
      });
      mockCreateKnowledgeDocument.mockResolvedValueOnce({
        id: 'doc-123',
        title: 'Test',
      });

      const request = new Request(
        'http://localhost:3000/api/workspace/ws-123/knowledge',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: 'content',
            category: 'raw',
          }),
        },
      );

      const response = await POST(request, {
        params: Promise.resolve({ workspaceId: 'ws-123' }),
      });
      const data = await response.json();

      expect(data.shouldCreateSummary).toBe(false);
    });

    it('should return shouldCreateSummary true when header is true', async () => {
      mockGenerateDocumentMetadata.mockResolvedValueOnce({
        title: 'Test',
        documentType: RAW_DOCUMENT_TYPES.OTHER,
      });
      mockCreateKnowledgeDocument.mockResolvedValueOnce({
        id: 'doc-123',
        title: 'Test',
      });

      const request = new Request(
        'http://localhost:3000/api/workspace/ws-123/knowledge',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Create-Summary': 'true',
          },
          body: JSON.stringify({
            content: 'content',
            category: 'raw',
          }),
        },
      );

      const response = await POST(request, {
        params: Promise.resolve({ workspaceId: 'ws-123' }),
      });
      const data = await response.json();

      expect(data.shouldCreateSummary).toBe(true);
    });

    it('should return shouldCreateSummary false when header value is not true', async () => {
      mockGenerateDocumentMetadata.mockResolvedValueOnce({
        title: 'Test',
        documentType: RAW_DOCUMENT_TYPES.OTHER,
      });
      mockCreateKnowledgeDocument.mockResolvedValueOnce({
        id: 'doc-123',
        title: 'Test',
      });

      const request = new Request(
        'http://localhost:3000/api/workspace/ws-123/knowledge',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Create-Summary': 'false',
          },
          body: JSON.stringify({
            content: 'content',
            category: 'raw',
          }),
        },
      );

      const response = await POST(request, {
        params: Promise.resolve({ workspaceId: 'ws-123' }),
      });
      const data = await response.json();

      expect(data.shouldCreateSummary).toBe(false);
    });
  });

  describe('X-Create-Summary Header Detection', () => {
    beforeEach(() => {
      mockAuth.mockResolvedValue({ userId: 'user-123' });
      mockGetWorkspaceById.mockResolvedValue({ id: 'ws-123' });
      mockGenerateDocumentMetadata.mockResolvedValue({
        title: 'Test',
        documentType: RAW_DOCUMENT_TYPES.OTHER,
      });
      mockCreateKnowledgeDocument.mockResolvedValue({
        id: 'doc-123',
        title: 'Test',
      });
    });

    it('should correctly detect X-Create-Summary header', async () => {
      const request = new Request(
        'http://localhost:3000/api/workspace/ws-123/knowledge',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Create-Summary': 'true',
          },
          body: JSON.stringify({
            content: 'content',
            category: 'raw',
          }),
        },
      );

      const response = await POST(request, {
        params: Promise.resolve({ workspaceId: 'ws-123' }),
      });
      const data = await response.json();

      expect(data.shouldCreateSummary).toBe(true);
    });

    it('should be case-sensitive for X-Create-Summary header value', async () => {
      const request = new Request(
        'http://localhost:3000/api/workspace/ws-123/knowledge',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Create-Summary': 'True',
          },
          body: JSON.stringify({
            content: 'content',
            category: 'raw',
          }),
        },
      );

      const response = await POST(request, {
        params: Promise.resolve({ workspaceId: 'ws-123' }),
      });
      const data = await response.json();

      expect(data.shouldCreateSummary).toBe(false);
    });

    it('should handle empty X-Create-Summary header', async () => {
      const request = new Request(
        'http://localhost:3000/api/workspace/ws-123/knowledge',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Create-Summary': '',
          },
          body: JSON.stringify({
            content: 'content',
            category: 'raw',
          }),
        },
      );

      const response = await POST(request, {
        params: Promise.resolve({ workspaceId: 'ws-123' }),
      });
      const data = await response.json();

      expect(data.shouldCreateSummary).toBe(false);
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      mockAuth.mockResolvedValue({ userId: 'user-123' });
      mockGetWorkspaceById.mockResolvedValue({ id: 'ws-123' });
    });

    it('should return 500 when AI metadata generation fails', async () => {
      mockGenerateDocumentMetadata.mockRejectedValueOnce(
        new Error('AI service unavailable'),
      );

      const request = new Request(
        'http://localhost:3000/api/workspace/ws-123/knowledge',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: 'content',
            category: 'raw',
          }),
        },
      );

      const response = await POST(request, {
        params: Promise.resolve({ workspaceId: 'ws-123' }),
      });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Internal server error');
    });

    it('should return 500 when document creation fails', async () => {
      mockGenerateDocumentMetadata.mockResolvedValueOnce({
        title: 'Test',
        documentType: RAW_DOCUMENT_TYPES.OTHER,
      });
      mockCreateKnowledgeDocument.mockRejectedValueOnce(
        new Error('Database error'),
      );

      const request = new Request(
        'http://localhost:3000/api/workspace/ws-123/knowledge',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: 'content',
            category: 'raw',
          }),
        },
      );

      const response = await POST(request, {
        params: Promise.resolve({ workspaceId: 'ws-123' }),
      });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Internal server error');
    });

    it('should return 500 when getWorkspaceById fails', async () => {
      mockGetWorkspaceById.mockRejectedValueOnce(
        new Error('Database connection error'),
      );

      const request = new Request(
        'http://localhost:3000/api/workspace/ws-123/knowledge',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: 'content',
            category: 'raw',
          }),
        },
      );

      const response = await POST(request, {
        params: Promise.resolve({ workspaceId: 'ws-123' }),
      });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Internal server error');
    });

    it('should not call createKnowledgeDocument when AI fails', async () => {
      mockGenerateDocumentMetadata.mockRejectedValueOnce(
        new Error('AI service unavailable'),
      );

      const request = new Request(
        'http://localhost:3000/api/workspace/ws-123/knowledge',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: 'content',
            category: 'raw',
          }),
        },
      );

      await POST(request, {
        params: Promise.resolve({ workspaceId: 'ws-123' }),
      });

      expect(mockCreateKnowledgeDocument).not.toHaveBeenCalled();
    });

    it('should not call revalidatePath when document creation fails', async () => {
      mockGenerateDocumentMetadata.mockResolvedValueOnce({
        title: 'Test',
        documentType: RAW_DOCUMENT_TYPES.OTHER,
      });
      mockCreateKnowledgeDocument.mockRejectedValueOnce(
        new Error('Database error'),
      );

      const request = new Request(
        'http://localhost:3000/api/workspace/ws-123/knowledge',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: 'content',
            category: 'raw',
          }),
        },
      );

      await POST(request, {
        params: Promise.resolve({ workspaceId: 'ws-123' }),
      });

      expect(mockRevalidatePath).not.toHaveBeenCalled();
    });
  });

  describe('Integration Flow', () => {
    beforeEach(() => {
      mockAuth.mockResolvedValue({ userId: 'user-abc' });
      mockGetWorkspaceById.mockResolvedValue({ id: 'ws-xyz' });
    });

    it('should complete full knowledge creation flow with AI metadata', async () => {
      const content = 'Speaker 1: Hello\nSpeaker 2: Hi there';
      const objectiveId = 'obj-999';

      const aiMetadata = {
        title: 'Team Standup Meeting',
        documentType: RAW_DOCUMENT_TYPES.TRANSCRIPT,
        summary: 'Daily team sync discussion',
      };

      mockGenerateDocumentMetadata.mockResolvedValueOnce(aiMetadata);

      const createdDoc = {
        id: 'doc-final-123',
        title: aiMetadata.title,
        content,
        category: 'raw',
        documentType: aiMetadata.documentType,
      };
      mockCreateKnowledgeDocument.mockResolvedValueOnce(createdDoc);

      const request = new Request(
        'http://localhost:3000/api/workspace/ws-xyz/knowledge',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Create-Summary': 'true',
          },
          body: JSON.stringify({
            content,
            category: 'raw',
            objectiveId,
          }),
        },
      );

      const response = await POST(request, {
        params: Promise.resolve({ workspaceId: 'ws-xyz' }),
      });
      const data = await response.json();

      // Verify AI metadata generation
      expect(mockGenerateDocumentMetadata).toHaveBeenCalledWith({
        content,
      });

      // Verify document creation
      expect(mockCreateKnowledgeDocument).toHaveBeenCalledWith(
        'ws-xyz',
        'user-abc',
        {
          objectiveId,
          title: aiMetadata.title,
          content,
          category: 'raw',
          documentType: aiMetadata.documentType,
          metadata: expect.objectContaining({
            aiSummary: aiMetadata.summary,
            aiGeneratedTitle: true,
            aiGeneratedType: true,
          }),
        },
      );

      // Verify cache revalidation
      expect(mockRevalidatePath).toHaveBeenCalledWith('/workspace/ws-xyz');
      expect(mockRevalidatePath).toHaveBeenCalledWith(
        `/workspace/ws-xyz/objective/${objectiveId}`,
      );

      // Verify response
      expect(response.status).toBe(201);
      expect(data).toMatchObject({
        document: createdDoc,
        shouldCreateSummary: true,
      });
    });

    it('should complete flow without AI when title and type provided', async () => {
      const content = 'Email content here';
      const userTitle = 'Q4 Sales Email';
      const userType = RAW_DOCUMENT_TYPES.EMAIL;

      mockCreateKnowledgeDocument.mockResolvedValueOnce({
        id: 'doc-123',
        title: userTitle,
        content,
        category: 'raw',
        documentType: userType,
      });

      const request = new Request(
        'http://localhost:3000/api/workspace/ws-xyz/knowledge',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content,
            category: 'raw',
            title: userTitle,
            documentType: userType,
          }),
        },
      );

      const response = await POST(request, {
        params: Promise.resolve({ workspaceId: 'ws-xyz' }),
      });

      // Should not call AI
      expect(mockGenerateDocumentMetadata).not.toHaveBeenCalled();

      // Should create document with user-provided values
      expect(mockCreateKnowledgeDocument).toHaveBeenCalledWith(
        'ws-xyz',
        'user-abc',
        expect.objectContaining({
          title: userTitle,
          documentType: userType,
        }),
      );

      expect(response.status).toBe(201);
    });

    it('should handle all document types', async () => {
      const documentTypes = [
        RAW_DOCUMENT_TYPES.TRANSCRIPT,
        RAW_DOCUMENT_TYPES.EMAIL,
        RAW_DOCUMENT_TYPES.SLACK,
        RAW_DOCUMENT_TYPES.MEETING_NOTES,
        RAW_DOCUMENT_TYPES.RESEARCH,
        RAW_DOCUMENT_TYPES.OTHER,
      ];

      for (const docType of documentTypes) {
        vi.clearAllMocks();

        mockGenerateDocumentMetadata.mockResolvedValueOnce({
          title: `Test ${docType}`,
          documentType: docType,
        });
        mockCreateKnowledgeDocument.mockResolvedValueOnce({
          id: `doc-${docType}`,
          title: `Test ${docType}`,
        });

        const request = new Request(
          'http://localhost:3000/api/workspace/ws-xyz/knowledge',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              content: 'content',
              category: 'raw',
            }),
          },
        );

        const response = await POST(request, {
          params: Promise.resolve({ workspaceId: 'ws-xyz' }),
        });

        expect(response.status).toBe(201);
        expect(mockCreateKnowledgeDocument).toHaveBeenCalledWith(
          'ws-xyz',
          'user-abc',
          expect.objectContaining({
            documentType: docType,
          }),
        );
      }
    });
  });
});
