import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/(chat)/api/files/upload/route';
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

vi.mock('@/lib/workspace/context', () => ({
  getActiveWorkspace: vi.fn(),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('@/lib/cache/document-cache.server', () => ({
  revalidateDocumentPaths: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  getLogger: vi.fn(() => ({
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  })),
}));

describe('POST /api/files/upload', () => {
  let mockAuth: ReturnType<typeof vi.fn>;
  let mockCreateKnowledgeDocument: ReturnType<typeof vi.fn>;
  let mockGenerateDocumentMetadata: ReturnType<typeof vi.fn>;
  let mockGetActiveWorkspace: ReturnType<typeof vi.fn>;
  let mockRevalidatePath: ReturnType<typeof vi.fn>;
  let mockRevalidateDocumentPaths: ReturnType<typeof vi.fn>;

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

    const { getActiveWorkspace } = await import('@/lib/workspace/context');
    mockGetActiveWorkspace = vi.mocked(getActiveWorkspace);

    const { revalidatePath } = await import('next/cache');
    mockRevalidatePath = vi.mocked(revalidatePath);

    const { revalidateDocumentPaths } = await import(
      '@/lib/cache/document-cache.server'
    );
    mockRevalidateDocumentPaths = vi.mocked(revalidateDocumentPaths);
  });

  describe('Authentication', () => {
    it('should return 401 when user is not authenticated', async () => {
      mockAuth.mockResolvedValueOnce({ userId: null });

      const request = new Request('http://localhost:3000/api/files/upload', {
        method: 'POST',
        body: new FormData(),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should proceed when user is authenticated', async () => {
      mockAuth.mockResolvedValueOnce({ userId: 'user-123' });

      const formData = new FormData();
      formData.append('file', new Blob(['content']), 'test.txt');
      formData.append('objectiveId', 'obj-123');

      const request = new Request('http://localhost:3000/api/files/upload', {
        method: 'POST',
        body: formData,
      });

      mockGetActiveWorkspace.mockResolvedValueOnce('workspace-123');
      mockGenerateDocumentMetadata.mockResolvedValueOnce({
        title: 'Test Document',
        documentType: RAW_DOCUMENT_TYPES.TRANSCRIPT,
      });
      mockCreateKnowledgeDocument.mockResolvedValueOnce({
        id: 'doc-123',
        isSearchable: true,
      });

      const response = await POST(request);

      expect(response.status).not.toBe(401);
    });
  });

  describe('Request Validation', () => {
    beforeEach(() => {
      mockAuth.mockResolvedValue({ userId: 'user-123' });
    });

    it('should return 400 when request body is empty', async () => {
      const request = new Request('http://localhost:3000/api/files/upload', {
        method: 'POST',
        body: null,
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
      const text = await response.text();
      expect(text).toBe('Request body is empty');
    });

    it('should return 400 when file is missing', async () => {
      const formData = new FormData();
      formData.append('objectiveId', 'obj-123');

      const request = new Request('http://localhost:3000/api/files/upload', {
        method: 'POST',
        body: formData,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('No file uploaded');
    });

    it('should return 400 when objectiveId is missing', async () => {
      const formData = new FormData();
      formData.append('file', new Blob(['content']), 'test.txt');

      const request = new Request('http://localhost:3000/api/files/upload', {
        method: 'POST',
        body: formData,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('objectiveId is required');
    });

    it('should accept request with both file and objectiveId', async () => {
      const formData = new FormData();
      formData.append('file', new Blob(['content']), 'test.txt');
      formData.append('objectiveId', 'obj-123');

      const request = new Request('http://localhost:3000/api/files/upload', {
        method: 'POST',
        body: formData,
      });

      mockGetActiveWorkspace.mockResolvedValueOnce('workspace-123');
      mockGenerateDocumentMetadata.mockResolvedValueOnce({
        title: 'Test Document',
        documentType: RAW_DOCUMENT_TYPES.TRANSCRIPT,
      });
      mockCreateKnowledgeDocument.mockResolvedValueOnce({
        id: 'doc-123',
        isSearchable: true,
      });

      const response = await POST(request);

      expect(response.status).not.toBe(400);
    });
  });

  describe('File Extension Validation', () => {
    beforeEach(() => {
      mockAuth.mockResolvedValue({ userId: 'user-123' });
    });

    const validExtensions = ['.txt', '.md', '.vtt', '.srt', '.transcript'];

    validExtensions.forEach((ext) => {
      it(`should accept ${ext} files`, async () => {
        const formData = new FormData();
        formData.append('file', new Blob(['content']), `test${ext}`);
        formData.append('objectiveId', 'obj-123');

        const request = new Request('http://localhost:3000/api/files/upload', {
          method: 'POST',
          body: formData,
        });

        mockGetActiveWorkspace.mockResolvedValueOnce('workspace-123');
        mockGenerateDocumentMetadata.mockResolvedValueOnce({
          title: 'Test Document',
          documentType: RAW_DOCUMENT_TYPES.TRANSCRIPT,
        });
        mockCreateKnowledgeDocument.mockResolvedValueOnce({
          id: 'doc-123',
          isSearchable: true,
        });

        const response = await POST(request);

        expect(response.status).toBe(200);
      });
    });

    it('should reject .pdf files', async () => {
      const formData = new FormData();
      formData.append('file', new Blob(['content']), 'document.pdf');
      formData.append('objectiveId', 'obj-123');

      const request = new Request('http://localhost:3000/api/files/upload', {
        method: 'POST',
        body: formData,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Unsupported file type');
      expect(data.error).toContain('.txt');
    });

    it('should reject .docx files', async () => {
      const formData = new FormData();
      formData.append('file', new Blob(['content']), 'document.docx');
      formData.append('objectiveId', 'obj-123');

      const request = new Request('http://localhost:3000/api/files/upload', {
        method: 'POST',
        body: formData,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Unsupported file type');
    });

    it('should reject files with no extension', async () => {
      const formData = new FormData();
      formData.append('file', new Blob(['content']), 'noextension');
      formData.append('objectiveId', 'obj-123');

      const request = new Request('http://localhost:3000/api/files/upload', {
        method: 'POST',
        body: formData,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Unsupported file type');
    });

    it('should handle case-insensitive extension matching', async () => {
      const formData = new FormData();
      formData.append('file', new Blob(['content']), 'TEST.TXT');
      formData.append('objectiveId', 'obj-123');

      const request = new Request('http://localhost:3000/api/files/upload', {
        method: 'POST',
        body: formData,
      });

      mockGetActiveWorkspace.mockResolvedValueOnce('workspace-123');
      mockGenerateDocumentMetadata.mockResolvedValueOnce({
        title: 'Test Document',
        documentType: RAW_DOCUMENT_TYPES.TRANSCRIPT,
      });
      mockCreateKnowledgeDocument.mockResolvedValueOnce({
        id: 'doc-123',
        isSearchable: true,
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
    });
  });

  describe('File Size Validation', () => {
    beforeEach(() => {
      mockAuth.mockResolvedValue({ userId: 'user-123' });
    });

    it('should accept files under 400KB', async () => {
      const content = 'a'.repeat(300 * 1024); // 300KB
      const formData = new FormData();
      formData.append('file', new Blob([content]), 'test.txt');
      formData.append('objectiveId', 'obj-123');

      const request = new Request('http://localhost:3000/api/files/upload', {
        method: 'POST',
        body: formData,
      });

      mockGetActiveWorkspace.mockResolvedValueOnce('workspace-123');
      mockGenerateDocumentMetadata.mockResolvedValueOnce({
        title: 'Test Document',
        documentType: RAW_DOCUMENT_TYPES.TRANSCRIPT,
      });
      mockCreateKnowledgeDocument.mockResolvedValueOnce({
        id: 'doc-123',
        isSearchable: true,
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
    });

    it('should accept files exactly at 400KB', async () => {
      const content = 'a'.repeat(400 * 1024); // Exactly 400KB
      const formData = new FormData();
      formData.append('file', new Blob([content]), 'test.txt');
      formData.append('objectiveId', 'obj-123');

      const request = new Request('http://localhost:3000/api/files/upload', {
        method: 'POST',
        body: formData,
      });

      mockGetActiveWorkspace.mockResolvedValueOnce('workspace-123');
      mockGenerateDocumentMetadata.mockResolvedValueOnce({
        title: 'Test Document',
        documentType: RAW_DOCUMENT_TYPES.TRANSCRIPT,
      });
      mockCreateKnowledgeDocument.mockResolvedValueOnce({
        id: 'doc-123',
        isSearchable: true,
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
    });

    it('should reject files over 400KB', async () => {
      const content = 'a'.repeat(401 * 1024); // 401KB
      const formData = new FormData();
      formData.append('file', new Blob([content]), 'toolarge.txt');
      formData.append('objectiveId', 'obj-123');

      const request = new Request('http://localhost:3000/api/files/upload', {
        method: 'POST',
        body: formData,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('400');
    });

    it('should show correct size limit in error message', async () => {
      const content = 'a'.repeat(500 * 1024); // 500KB
      const formData = new FormData();
      formData.append('file', new Blob([content]), 'huge.txt');
      formData.append('objectiveId', 'obj-123');

      const request = new Request('http://localhost:3000/api/files/upload', {
        method: 'POST',
        body: formData,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('400KB');
    });
  });

  describe('AI Metadata Generation', () => {
    beforeEach(() => {
      mockAuth.mockResolvedValue({ userId: 'user-123' });
      mockGetActiveWorkspace.mockResolvedValue('workspace-123');
    });

    it('should call generateDocumentMetadata with content and fileName', async () => {
      const fileContent = 'This is a meeting transcript';
      const fileName = 'meeting-notes.txt';
      const formData = new FormData();
      formData.append('file', new Blob([fileContent]), fileName);
      formData.append('objectiveId', 'obj-123');

      const request = new Request('http://localhost:3000/api/files/upload', {
        method: 'POST',
        body: formData,
      });

      mockGenerateDocumentMetadata.mockResolvedValueOnce({
        title: 'Meeting Notes',
        documentType: RAW_DOCUMENT_TYPES.TRANSCRIPT,
      });
      mockCreateKnowledgeDocument.mockResolvedValueOnce({
        id: 'doc-123',
        isSearchable: true,
      });

      await POST(request);

      expect(mockGenerateDocumentMetadata).toHaveBeenCalledWith({
        content: fileContent,
        fileName: fileName,
      });
    });

    it('should use AI-generated title for document', async () => {
      const formData = new FormData();
      formData.append('file', new Blob(['content']), 'test.txt');
      formData.append('objectiveId', 'obj-123');

      const request = new Request('http://localhost:3000/api/files/upload', {
        method: 'POST',
        body: formData,
      });

      const aiTitle = 'Q4 Sales Review Meeting';
      mockGenerateDocumentMetadata.mockResolvedValueOnce({
        title: aiTitle,
        documentType: RAW_DOCUMENT_TYPES.TRANSCRIPT,
      });
      mockCreateKnowledgeDocument.mockResolvedValueOnce({
        id: 'doc-123',
        isSearchable: true,
      });

      await POST(request);

      expect(mockCreateKnowledgeDocument).toHaveBeenCalledWith(
        'workspace-123',
        'user-123',
        expect.objectContaining({
          title: aiTitle,
        }),
      );
    });

    it('should use AI-generated documentType', async () => {
      const formData = new FormData();
      formData.append('file', new Blob(['content']), 'test.txt');
      formData.append('objectiveId', 'obj-123');

      const request = new Request('http://localhost:3000/api/files/upload', {
        method: 'POST',
        body: formData,
      });

      mockGenerateDocumentMetadata.mockResolvedValueOnce({
        title: 'Email Thread',
        documentType: RAW_DOCUMENT_TYPES.EMAIL,
      });
      mockCreateKnowledgeDocument.mockResolvedValueOnce({
        id: 'doc-123',
        isSearchable: true,
      });

      await POST(request);

      expect(mockCreateKnowledgeDocument).toHaveBeenCalledWith(
        'workspace-123',
        'user-123',
        expect.objectContaining({
          documentType: RAW_DOCUMENT_TYPES.EMAIL,
        }),
      );
    });

    it('should store AI summary in metadata when provided', async () => {
      const formData = new FormData();
      formData.append('file', new Blob(['content']), 'test.txt');
      formData.append('objectiveId', 'obj-123');

      const request = new Request('http://localhost:3000/api/files/upload', {
        method: 'POST',
        body: formData,
      });

      const aiSummary = 'Discussion of Q4 sales targets and strategy';
      mockGenerateDocumentMetadata.mockResolvedValueOnce({
        title: 'Q4 Sales Meeting',
        documentType: RAW_DOCUMENT_TYPES.TRANSCRIPT,
        summary: aiSummary,
      });
      mockCreateKnowledgeDocument.mockResolvedValueOnce({
        id: 'doc-123',
        isSearchable: true,
      });

      await POST(request);

      expect(mockCreateKnowledgeDocument).toHaveBeenCalledWith(
        'workspace-123',
        'user-123',
        expect.objectContaining({
          metadata: expect.objectContaining({
            aiSummary: aiSummary,
          }),
        }),
      );
    });

    it('should handle missing AI summary gracefully', async () => {
      const formData = new FormData();
      formData.append('file', new Blob(['content']), 'test.txt');
      formData.append('objectiveId', 'obj-123');

      const request = new Request('http://localhost:3000/api/files/upload', {
        method: 'POST',
        body: formData,
      });

      mockGenerateDocumentMetadata.mockResolvedValueOnce({
        title: 'Short Note',
        documentType: RAW_DOCUMENT_TYPES.OTHER,
        // No summary field
      });
      mockCreateKnowledgeDocument.mockResolvedValueOnce({
        id: 'doc-123',
        isSearchable: true,
      });

      await POST(request);

      expect(mockCreateKnowledgeDocument).toHaveBeenCalledWith(
        'workspace-123',
        'user-123',
        expect.objectContaining({
          metadata: expect.objectContaining({
            aiSummary: undefined,
          }),
        }),
      );
    });
  });

  describe('Knowledge Document Creation', () => {
    beforeEach(() => {
      mockAuth.mockResolvedValue({ userId: 'user-123' });
      mockGetActiveWorkspace.mockResolvedValue('workspace-456');
      mockGenerateDocumentMetadata.mockResolvedValue({
        title: 'Test Document',
        documentType: RAW_DOCUMENT_TYPES.TRANSCRIPT,
      });
    });

    it('should create knowledge document with raw category', async () => {
      const formData = new FormData();
      formData.append('file', new Blob(['content']), 'test.txt');
      formData.append('objectiveId', 'obj-123');

      const request = new Request('http://localhost:3000/api/files/upload', {
        method: 'POST',
        body: formData,
      });

      mockCreateKnowledgeDocument.mockResolvedValueOnce({
        id: 'doc-123',
        isSearchable: true,
      });

      await POST(request);

      expect(mockCreateKnowledgeDocument).toHaveBeenCalledWith(
        'workspace-456',
        'user-123',
        expect.objectContaining({
          category: 'raw',
        }),
      );
    });

    it('should link document to objectiveId', async () => {
      const objectiveId = 'obj-789';
      const formData = new FormData();
      formData.append('file', new Blob(['content']), 'test.txt');
      formData.append('objectiveId', objectiveId);

      const request = new Request('http://localhost:3000/api/files/upload', {
        method: 'POST',
        body: formData,
      });

      mockCreateKnowledgeDocument.mockResolvedValueOnce({
        id: 'doc-123',
        isSearchable: true,
      });

      await POST(request);

      expect(mockCreateKnowledgeDocument).toHaveBeenCalledWith(
        'workspace-456',
        'user-123',
        expect.objectContaining({
          objectiveId: objectiveId,
        }),
      );
    });

    it('should store file content', async () => {
      const fileContent = 'This is the transcript content with speaker labels';
      const formData = new FormData();
      formData.append('file', new Blob([fileContent]), 'test.txt');
      formData.append('objectiveId', 'obj-123');

      const request = new Request('http://localhost:3000/api/files/upload', {
        method: 'POST',
        body: formData,
      });

      mockCreateKnowledgeDocument.mockResolvedValueOnce({
        id: 'doc-123',
        isSearchable: true,
      });

      await POST(request);

      expect(mockCreateKnowledgeDocument).toHaveBeenCalledWith(
        'workspace-456',
        'user-123',
        expect.objectContaining({
          content: fileContent,
        }),
      );
    });

    it('should store metadata with fileName, fileSize, uploadedAt', async () => {
      const fileName = 'meeting-2024.txt';
      const fileContent = 'a'.repeat(1000);
      const formData = new FormData();
      const file = new Blob([fileContent]);
      formData.append('file', file, fileName);
      formData.append('objectiveId', 'obj-123');

      const request = new Request('http://localhost:3000/api/files/upload', {
        method: 'POST',
        body: formData,
      });

      mockCreateKnowledgeDocument.mockResolvedValueOnce({
        id: 'doc-123',
        isSearchable: true,
      });

      const beforeTime = new Date().toISOString();
      await POST(request);
      const afterTime = new Date().toISOString();

      const callArgs = mockCreateKnowledgeDocument.mock.calls[0][2];
      expect(callArgs.metadata).toMatchObject({
        fileName: fileName,
        fileSize: file.size,
      });

      // Verify uploadedAt is a recent timestamp
      const uploadedAt = callArgs.metadata?.uploadedAt as string;
      expect(uploadedAt).toBeDefined();
      expect(uploadedAt >= beforeTime).toBeTruthy();
      expect(uploadedAt <= afterTime).toBeTruthy();
    });
  });

  describe('Cache Revalidation', () => {
    beforeEach(() => {
      mockAuth.mockResolvedValue({ userId: 'user-123' });
      mockGetActiveWorkspace.mockResolvedValue('workspace-789');
      mockGenerateDocumentMetadata.mockResolvedValue({
        title: 'Test Document',
        documentType: RAW_DOCUMENT_TYPES.TRANSCRIPT,
      });
      mockCreateKnowledgeDocument.mockResolvedValue({
        id: 'doc-456',
        isSearchable: true,
      });
    });

    it('should call revalidatePath for workspace path', async () => {
      const formData = new FormData();
      formData.append('file', new Blob(['content']), 'test.txt');
      formData.append('objectiveId', 'obj-123');

      const request = new Request('http://localhost:3000/api/files/upload', {
        method: 'POST',
        body: formData,
      });

      await POST(request);

      expect(mockRevalidatePath).toHaveBeenCalledWith(
        '/workspace/workspace-789',
      );
    });

    it('should call revalidatePath for objective path', async () => {
      const objectiveId = 'obj-555';
      const formData = new FormData();
      formData.append('file', new Blob(['content']), 'test.txt');
      formData.append('objectiveId', objectiveId);

      const request = new Request('http://localhost:3000/api/files/upload', {
        method: 'POST',
        body: formData,
      });

      await POST(request);

      expect(mockRevalidatePath).toHaveBeenCalledWith(
        `/workspace/workspace-789/objective/${objectiveId}`,
      );
    });

    it('should call revalidateDocumentPaths with workspaceId and documentId', async () => {
      const formData = new FormData();
      formData.append('file', new Blob(['content']), 'test.txt');
      formData.append('objectiveId', 'obj-123');

      const request = new Request('http://localhost:3000/api/files/upload', {
        method: 'POST',
        body: formData,
      });

      await POST(request);

      expect(mockRevalidateDocumentPaths).toHaveBeenCalledWith(
        'workspace-789',
        'doc-456',
      );
    });
  });

  describe('Success Response', () => {
    beforeEach(() => {
      mockAuth.mockResolvedValue({ userId: 'user-123' });
      mockGetActiveWorkspace.mockResolvedValue('workspace-123');
    });

    it('should return success response with documentId', async () => {
      const formData = new FormData();
      formData.append('file', new Blob(['content']), 'test.txt');
      formData.append('objectiveId', 'obj-123');

      const request = new Request('http://localhost:3000/api/files/upload', {
        method: 'POST',
        body: formData,
      });

      const documentId = 'doc-xyz-789';
      mockGenerateDocumentMetadata.mockResolvedValueOnce({
        title: 'Test Title',
        documentType: RAW_DOCUMENT_TYPES.TRANSCRIPT,
      });
      mockCreateKnowledgeDocument.mockResolvedValueOnce({
        id: documentId,
        isSearchable: true,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.documentId).toBe(documentId);
    });

    it('should return AI-generated title in response', async () => {
      const formData = new FormData();
      formData.append('file', new Blob(['content']), 'test.txt');
      formData.append('objectiveId', 'obj-123');

      const request = new Request('http://localhost:3000/api/files/upload', {
        method: 'POST',
        body: formData,
      });

      const aiTitle = 'Engineering Sync Meeting';
      mockGenerateDocumentMetadata.mockResolvedValueOnce({
        title: aiTitle,
        documentType: RAW_DOCUMENT_TYPES.TRANSCRIPT,
      });
      mockCreateKnowledgeDocument.mockResolvedValueOnce({
        id: 'doc-123',
        isSearchable: true,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data.title).toBe(aiTitle);
    });

    it('should return AI-generated documentType in response', async () => {
      const formData = new FormData();
      formData.append('file', new Blob(['content']), 'test.txt');
      formData.append('objectiveId', 'obj-123');

      const request = new Request('http://localhost:3000/api/files/upload', {
        method: 'POST',
        body: formData,
      });

      mockGenerateDocumentMetadata.mockResolvedValueOnce({
        title: 'Research Paper',
        documentType: RAW_DOCUMENT_TYPES.RESEARCH,
      });
      mockCreateKnowledgeDocument.mockResolvedValueOnce({
        id: 'doc-123',
        isSearchable: true,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data.documentType).toBe(RAW_DOCUMENT_TYPES.RESEARCH);
    });

    it('should return fileName in response', async () => {
      const fileName = 'quarterly-review.txt';
      const formData = new FormData();
      formData.append('file', new Blob(['content']), fileName);
      formData.append('objectiveId', 'obj-123');

      const request = new Request('http://localhost:3000/api/files/upload', {
        method: 'POST',
        body: formData,
      });

      mockGenerateDocumentMetadata.mockResolvedValueOnce({
        title: 'Quarterly Review',
        documentType: RAW_DOCUMENT_TYPES.TRANSCRIPT,
      });
      mockCreateKnowledgeDocument.mockResolvedValueOnce({
        id: 'doc-123',
        isSearchable: true,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data.fileName).toBe(fileName);
    });

    it('should return message with document ID and filename', async () => {
      const fileName = 'meeting.txt';
      const documentId = 'doc-999';
      const formData = new FormData();
      formData.append('file', new Blob(['content']), fileName);
      formData.append('objectiveId', 'obj-123');

      const request = new Request('http://localhost:3000/api/files/upload', {
        method: 'POST',
        body: formData,
      });

      mockGenerateDocumentMetadata.mockResolvedValueOnce({
        title: 'Meeting',
        documentType: RAW_DOCUMENT_TYPES.TRANSCRIPT,
      });
      mockCreateKnowledgeDocument.mockResolvedValueOnce({
        id: documentId,
        isSearchable: true,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data.message).toContain('TRANSCRIPT_DOCUMENT:');
      expect(data.message).toContain(documentId);
      expect(data.message).toContain(fileName);
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      mockAuth.mockResolvedValue({ userId: 'user-123' });
      mockGetActiveWorkspace.mockResolvedValue('workspace-123');
    });

    it('should return 500 when AI metadata generation fails', async () => {
      const formData = new FormData();
      formData.append('file', new Blob(['content']), 'test.txt');
      formData.append('objectiveId', 'obj-123');

      const request = new Request('http://localhost:3000/api/files/upload', {
        method: 'POST',
        body: formData,
      });

      mockGenerateDocumentMetadata.mockRejectedValueOnce(
        new Error('AI service unavailable'),
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to process transcript upload');
    });

    it('should return 500 when document creation fails', async () => {
      const formData = new FormData();
      formData.append('file', new Blob(['content']), 'test.txt');
      formData.append('objectiveId', 'obj-123');

      const request = new Request('http://localhost:3000/api/files/upload', {
        method: 'POST',
        body: formData,
      });

      mockGenerateDocumentMetadata.mockResolvedValueOnce({
        title: 'Test',
        documentType: RAW_DOCUMENT_TYPES.TRANSCRIPT,
      });
      mockCreateKnowledgeDocument.mockRejectedValueOnce(
        new Error('Database error'),
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to process transcript upload');
    });

    it('should return 500 when getActiveWorkspace fails', async () => {
      const formData = new FormData();
      formData.append('file', new Blob(['content']), 'test.txt');
      formData.append('objectiveId', 'obj-123');

      const request = new Request('http://localhost:3000/api/files/upload', {
        method: 'POST',
        body: formData,
      });

      mockGetActiveWorkspace.mockRejectedValueOnce(
        new Error('Workspace not found'),
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to process transcript upload');
    });
  });

  describe('Integration Flow', () => {
    beforeEach(() => {
      mockAuth.mockResolvedValue({ userId: 'user-abc' });
      mockGetActiveWorkspace.mockResolvedValue('workspace-xyz');
    });

    it('should complete full upload flow successfully', async () => {
      const fileContent = 'Speaker 1: Hello everyone\nSpeaker 2: Hi there';
      const fileName = 'team-standup.txt';
      const objectiveId = 'obj-999';

      const formData = new FormData();
      formData.append('file', new Blob([fileContent]), fileName);
      formData.append('objectiveId', objectiveId);

      const request = new Request('http://localhost:3000/api/files/upload', {
        method: 'POST',
        body: formData,
      });

      const aiMetadata = {
        title: 'Team Standup Meeting',
        documentType: RAW_DOCUMENT_TYPES.TRANSCRIPT,
        summary: 'Daily team sync discussion',
      };

      mockGenerateDocumentMetadata.mockResolvedValueOnce(aiMetadata);

      const createdDoc = {
        id: 'doc-final-123',
        isSearchable: true,
      };
      mockCreateKnowledgeDocument.mockResolvedValueOnce(createdDoc);

      const response = await POST(request);
      const data = await response.json();

      // Verify AI metadata generation was called
      expect(mockGenerateDocumentMetadata).toHaveBeenCalledWith({
        content: fileContent,
        fileName: fileName,
      });

      // Verify document creation
      expect(mockCreateKnowledgeDocument).toHaveBeenCalledWith(
        'workspace-xyz',
        'user-abc',
        {
          objectiveId: objectiveId,
          title: aiMetadata.title,
          content: fileContent,
          category: 'raw',
          documentType: aiMetadata.documentType,
          metadata: expect.objectContaining({
            fileName: fileName,
            fileSize: expect.any(Number),
            uploadedAt: expect.any(String),
            aiSummary: aiMetadata.summary,
          }),
        },
      );

      // Verify cache revalidation
      expect(mockRevalidateDocumentPaths).toHaveBeenCalledWith(
        'workspace-xyz',
        createdDoc.id,
      );
      expect(mockRevalidatePath).toHaveBeenCalledWith(
        '/workspace/workspace-xyz',
      );
      expect(mockRevalidatePath).toHaveBeenCalledWith(
        `/workspace/workspace-xyz/objective/${objectiveId}`,
      );

      // Verify response
      expect(response.status).toBe(200);
      expect(data).toMatchObject({
        success: true,
        documentId: createdDoc.id,
        fileName: fileName,
        title: aiMetadata.title,
        documentType: aiMetadata.documentType,
      });
      expect(data.message).toContain('TRANSCRIPT_DOCUMENT:');
    });

    it('should handle all file types in integration flow', async () => {
      const testFiles = [
        { ext: '.txt', type: RAW_DOCUMENT_TYPES.TRANSCRIPT },
        { ext: '.md', type: RAW_DOCUMENT_TYPES.MEETING_NOTES },
        { ext: '.vtt', type: RAW_DOCUMENT_TYPES.TRANSCRIPT },
        { ext: '.srt', type: RAW_DOCUMENT_TYPES.TRANSCRIPT },
        { ext: '.transcript', type: RAW_DOCUMENT_TYPES.TRANSCRIPT },
      ];

      for (const { ext, type } of testFiles) {
        vi.clearAllMocks();

        const formData = new FormData();
        formData.append('file', new Blob(['content']), `file${ext}`);
        formData.append('objectiveId', 'obj-123');

        const request = new Request('http://localhost:3000/api/files/upload', {
          method: 'POST',
          body: formData,
        });

        mockGenerateDocumentMetadata.mockResolvedValueOnce({
          title: `Test ${ext}`,
          documentType: type,
        });
        mockCreateKnowledgeDocument.mockResolvedValueOnce({
          id: `doc-${ext}`,
          isSearchable: true,
        });

        const response = await POST(request);

        expect(response.status).toBe(200);
        expect(mockCreateKnowledgeDocument).toHaveBeenCalledWith(
          'workspace-xyz',
          'user-abc',
          expect.objectContaining({
            documentType: type,
          }),
        );
      }
    });
  });
});
