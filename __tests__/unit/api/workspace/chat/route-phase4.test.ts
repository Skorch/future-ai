import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/(chat)/api/workspace/[workspaceId]/chat/route';

// Mock dependencies
vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(),
}));

vi.mock('@/lib/db/queries', () => ({
  getChatByIdWithWorkspace: vi.fn(),
  saveChat: vi.fn(),
  saveMessages: vi.fn(),
  getMessagesByChatId: vi.fn(),
  createStreamId: vi.fn(),
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(() => Promise.resolve([{ domainId: 'default' }])),
        })),
      })),
    })),
  },
}));

vi.mock('@/lib/db/objective', () => ({
  getOrCreateActiveObjective: vi.fn(),
}));

vi.mock('@/app/(chat)/actions', () => ({
  generateTitleFromUserMessage: vi.fn(),
}));

vi.mock('ai', () => ({
  streamText: vi.fn(),
  convertToModelMessages: vi.fn(() => []),
  createUIMessageStream: vi.fn(() => ({
    execute: vi.fn(),
    generateId: vi.fn(),
    onFinish: vi.fn(),
    onError: vi.fn(),
    pipeThrough: vi.fn(),
  })),
  JsonToSseTransformStream: vi.fn(() => ({})),
  smoothStream: vi.fn(() => ({})),
  stepCountIs: vi.fn(),
  hasToolCall: vi.fn(),
}));

vi.mock('@/lib/ai/prompts/system', () => ({
  composeSystemPrompt: vi.fn(() => Promise.resolve('System prompt')),
}));

vi.mock('@/lib/domains', () => ({
  getDomain: vi.fn(() => ({ label: 'Test Domain', prompt: 'Test prompt' })),
  DEFAULT_DOMAIN: 'default',
}));

vi.mock('@/lib/ai/providers', () => ({
  myProvider: {
    languageModel: vi.fn(() => ({})),
  },
}));

vi.mock('@/lib/ai/utils/token-analyzer', () => ({
  analyzeTokenUsage: vi.fn(() => ({
    systemPromptTokens: 100,
    userTokens: 100,
    assistantTokens: 0,
    totalTokens: 200,
    isOverLimit: false,
    isApproachingLimit: false,
    largestMessages: [],
  })),
  logTokenStats: vi.fn(),
}));

vi.mock('@/lib/ai/modes', () => ({
  getModeConfig: vi.fn(() => ({
    model: 'claude-sonnet-4',
    experimental_activeTools: [],
  })),
}));

vi.mock('@/lib/ai/modes/prepare-step', () => ({
  createPrepareStep: vi.fn(() => vi.fn()),
}));

vi.mock('@/lib/ai/utils/file-processor', () => ({
  processMessageFiles: vi.fn((messages) => Promise.resolve(messages)),
}));

// Mock all AI tools
vi.mock('@/lib/ai/tools/create-document', () => ({
  createDocument: vi.fn(() => Promise.resolve({})),
}));

vi.mock('@/lib/ai/tools/update-document', () => ({
  updateDocument: vi.fn(() => ({})),
}));

vi.mock('@/lib/ai/tools/query-rag', () => ({
  queryRAG: vi.fn(() => ({})),
}));

vi.mock('@/lib/ai/tools/list-documents', () => ({
  listDocuments: vi.fn(() => Promise.resolve({})),
}));

vi.mock('@/lib/ai/tools/load-document', () => ({
  loadDocument: vi.fn(() => ({})),
}));

vi.mock('@/lib/ai/tools/load-documents', () => ({
  loadDocuments: vi.fn(() => ({})),
}));

vi.mock('@/lib/ai/tools/ask-user', () => ({
  askUser: vi.fn(() => ({})),
}));

vi.mock('@/lib/ai/tools/get-playbook', () => ({
  getPlaybook: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('@/lib/logger', () => ({
  getLogger: vi.fn(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

vi.mock('@/lib/utils', () => ({
  convertToUIMessages: vi.fn(() => []),
  generateUUID: vi.fn(() => 'test-uuid-123'),
  fetcher: vi.fn(),
  fetchWithErrorHandlers: vi.fn(),
}));

describe('Chat API Route - Phase 4: ObjectiveId Handling', () => {
  const mockWorkspaceId = 'workspace-123';
  const mockUserId = 'user-456';
  const mockChatId = 'chat-789';

  beforeEach(async () => {
    vi.clearAllMocks();

    // Setup default mocks
    const { auth } = await import('@clerk/nextjs/server');
    vi.mocked(auth).mockResolvedValue({ userId: mockUserId } as any);

    const { getChatByIdWithWorkspace, getMessagesByChatId, createStreamId } =
      await import('@/lib/db/queries');

    vi.mocked(getChatByIdWithWorkspace).mockResolvedValue(null);
    vi.mocked(getMessagesByChatId).mockResolvedValue([]);
    vi.mocked(createStreamId).mockResolvedValue(undefined);

    const { generateTitleFromUserMessage } = await import(
      '@/app/(chat)/actions'
    );
    vi.mocked(generateTitleFromUserMessage).mockResolvedValue('Test Title');

    const { getOrCreateActiveObjective } = await import('@/lib/db/objective');
    vi.mocked(getOrCreateActiveObjective).mockResolvedValue(
      'active-objective-123',
    );
  });

  describe('ObjectiveId from Request', () => {
    it('should use provided objectiveId when present in request body', async () => {
      const providedObjectiveId = 'objective-custom-999';

      const request = new Request(
        'http://localhost/api/workspace/workspace-123/chat',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: mockChatId,
            message: {
              id: 'msg-1',
              role: 'user',
              parts: [{ type: 'text', text: 'Hello' }],
            },
            selectedVisibilityType: 'private',
            objectiveId: providedObjectiveId,
          }),
        },
      );

      const params = Promise.resolve({ workspaceId: mockWorkspaceId });

      await POST(request, { params });

      const { saveChat } = await import('@/lib/db/queries');

      expect(saveChat).toHaveBeenCalledWith({
        id: mockChatId,
        userId: mockUserId,
        title: expect.any(String),
        visibility: 'private',
        objectiveId: providedObjectiveId,
      });
    });

    it('should fall back to active objective when objectiveId not provided', async () => {
      const request = new Request(
        'http://localhost/api/workspace/workspace-123/chat',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: mockChatId,
            message: {
              id: 'msg-1',
              role: 'user',
              parts: [{ type: 'text', text: 'Hello' }],
            },
            selectedVisibilityType: 'private',
            // No objectiveId provided
          }),
        },
      );

      const params = Promise.resolve({ workspaceId: mockWorkspaceId });

      await POST(request, { params });

      const { getOrCreateActiveObjective } = await import('@/lib/db/objective');
      const { saveChat } = await import('@/lib/db/queries');

      expect(getOrCreateActiveObjective).toHaveBeenCalledWith(
        mockWorkspaceId,
        mockUserId,
      );

      expect(saveChat).toHaveBeenCalledWith({
        id: mockChatId,
        userId: mockUserId,
        title: expect.any(String),
        visibility: 'private',
        objectiveId: 'active-objective-123',
      });
    });

    it('should validate objectiveId UUID format', async () => {
      const invalidObjectiveId = 'not-a-uuid';

      const request = new Request(
        'http://localhost/api/workspace/workspace-123/chat',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: mockChatId,
            message: {
              id: 'msg-1',
              role: 'user',
              parts: [{ type: 'text', text: 'Hello' }],
            },
            selectedVisibilityType: 'private',
            objectiveId: invalidObjectiveId,
          }),
        },
      );

      const params = Promise.resolve({ workspaceId: mockWorkspaceId });

      const response = await POST(request, { params });

      // Should return bad request error
      expect(response.status).toBe(400);
    });

    it('should accept valid UUID for objectiveId', async () => {
      const validObjectiveId = '550e8400-e29b-41d4-a716-446655440000';

      const request = new Request(
        'http://localhost/api/workspace/workspace-123/chat',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: mockChatId,
            message: {
              id: 'msg-1',
              role: 'user',
              parts: [{ type: 'text', text: 'Hello' }],
            },
            selectedVisibilityType: 'private',
            objectiveId: validObjectiveId,
          }),
        },
      );

      const params = Promise.resolve({ workspaceId: mockWorkspaceId });

      await POST(request, { params });

      const { saveChat } = await import('@/lib/db/queries');

      expect(saveChat).toHaveBeenCalledWith(
        expect.objectContaining({
          objectiveId: validObjectiveId,
        }),
      );
    });
  });

  describe('Existing Chat Handling', () => {
    it('should not call getOrCreateActiveObjective when chat already exists', async () => {
      const existingChat = {
        id: mockChatId,
        userId: mockUserId,
        workspaceId: mockWorkspaceId,
        title: 'Existing Chat',
        visibility: 'private',
        objectiveId: 'existing-objective-123',
      };

      const { getChatByIdWithWorkspace } = await import('@/lib/db/queries');
      vi.mocked(getChatByIdWithWorkspace).mockResolvedValue(
        existingChat as any,
      );

      const request = new Request(
        'http://localhost/api/workspace/workspace-123/chat',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: mockChatId,
            message: {
              id: 'msg-1',
              role: 'user',
              parts: [{ type: 'text', text: 'Hello' }],
            },
            selectedVisibilityType: 'private',
          }),
        },
      );

      const params = Promise.resolve({ workspaceId: mockWorkspaceId });

      await POST(request, { params });

      const { getOrCreateActiveObjective } = await import('@/lib/db/objective');
      const { saveChat } = await import('@/lib/db/queries');

      // Should not create/get active objective
      expect(getOrCreateActiveObjective).not.toHaveBeenCalled();

      // Should not call saveChat (chat already exists)
      expect(saveChat).not.toHaveBeenCalled();
    });
  });

  describe('Backward Compatibility', () => {
    it('should work with requests that do not include objectiveId', async () => {
      const request = new Request(
        'http://localhost/api/workspace/workspace-123/chat',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: mockChatId,
            message: {
              id: 'msg-1',
              role: 'user',
              parts: [{ type: 'text', text: 'Hello' }],
            },
            selectedVisibilityType: 'private',
          }),
        },
      );

      const params = Promise.resolve({ workspaceId: mockWorkspaceId });

      const response = await POST(request, { params });

      // Should not error, should use fallback
      expect(response.status).not.toBe(400);

      const { getOrCreateActiveObjective } = await import('@/lib/db/objective');

      expect(getOrCreateActiveObjective).toHaveBeenCalled();
    });

    it('should maintain existing functionality when objectiveId is null', async () => {
      const request = new Request(
        'http://localhost/api/workspace/workspace-123/chat',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: mockChatId,
            message: {
              id: 'msg-1',
              role: 'user',
              parts: [{ type: 'text', text: 'Hello' }],
            },
            selectedVisibilityType: 'private',
            objectiveId: null,
          }),
        },
      );

      const params = Promise.resolve({ workspaceId: mockWorkspaceId });

      const response = await POST(request, { params });

      // Schema validation should fail (objectiveId must be undefined or valid UUID)
      expect(response.status).toBe(400);
    });

    it('should maintain existing functionality when objectiveId is undefined', async () => {
      const request = new Request(
        'http://localhost/api/workspace/workspace-123/chat',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: mockChatId,
            message: {
              id: 'msg-1',
              role: 'user',
              parts: [{ type: 'text', text: 'Hello' }],
            },
            selectedVisibilityType: 'private',
            objectiveId: undefined,
          }),
        },
      );

      const params = Promise.resolve({ workspaceId: mockWorkspaceId });

      await POST(request, { params });

      const { getOrCreateActiveObjective } = await import('@/lib/db/objective');

      // Should fall back to active objective
      expect(getOrCreateActiveObjective).toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty string objectiveId as invalid', async () => {
      const request = new Request(
        'http://localhost/api/workspace/workspace-123/chat',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: mockChatId,
            message: {
              id: 'msg-1',
              role: 'user',
              parts: [{ type: 'text', text: 'Hello' }],
            },
            selectedVisibilityType: 'private',
            objectiveId: '',
          }),
        },
      );

      const params = Promise.resolve({ workspaceId: mockWorkspaceId });

      const response = await POST(request, { params });

      expect(response.status).toBe(400);
    });

    it('should handle objectiveId with incorrect UUID version', async () => {
      // Valid UUID v1 instead of v4
      const uuidV1 = '12345678-1234-1234-1234-123456789012';

      const request = new Request(
        'http://localhost/api/workspace/workspace-123/chat',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: mockChatId,
            message: {
              id: 'msg-1',
              role: 'user',
              parts: [{ type: 'text', text: 'Hello' }],
            },
            selectedVisibilityType: 'private',
            objectiveId: uuidV1,
          }),
        },
      );

      const params = Promise.resolve({ workspaceId: mockWorkspaceId });

      await POST(request, { params });

      const { saveChat } = await import('@/lib/db/queries');

      // Should accept any valid UUID format
      expect(saveChat).toHaveBeenCalledWith(
        expect.objectContaining({
          objectiveId: uuidV1,
        }),
      );
    });

    it('should handle multiple chats with different objectiveIds', async () => {
      const { saveChat } = await import('@/lib/db/queries');

      // First request
      const request1 = new Request(
        'http://localhost/api/workspace/workspace-123/chat',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: 'chat-1',
            message: {
              id: 'msg-1',
              role: 'user',
              parts: [{ type: 'text', text: 'Hello' }],
            },
            selectedVisibilityType: 'private',
            objectiveId: 'objective-1',
          }),
        },
      );

      await POST(request1, {
        params: Promise.resolve({ workspaceId: mockWorkspaceId }),
      });

      expect(saveChat).toHaveBeenCalledWith(
        expect.objectContaining({ objectiveId: 'objective-1' }),
      );

      vi.clearAllMocks();

      // Second request with different objectiveId
      const request2 = new Request(
        'http://localhost/api/workspace/workspace-123/chat',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: 'chat-2',
            message: {
              id: 'msg-2',
              role: 'user',
              parts: [{ type: 'text', text: 'Hello again' }],
            },
            selectedVisibilityType: 'private',
            objectiveId: 'objective-2',
          }),
        },
      );

      await POST(request2, {
        params: Promise.resolve({ workspaceId: mockWorkspaceId }),
      });

      expect(saveChat).toHaveBeenCalledWith(
        expect.objectContaining({ objectiveId: 'objective-2' }),
      );
    });
  });

  describe('Schema Validation', () => {
    it('should accept optional objectiveId in schema', async () => {
      const request = new Request(
        'http://localhost/api/workspace/workspace-123/chat',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: mockChatId,
            message: {
              id: 'msg-1',
              role: 'user',
              parts: [{ type: 'text', text: 'Hello' }],
            },
            selectedVisibilityType: 'private',
            // objectiveId omitted
          }),
        },
      );

      const params = Promise.resolve({ workspaceId: mockWorkspaceId });

      const response = await POST(request, { params });

      // Should not fail schema validation
      expect(response.status).not.toBe(400);
    });

    it('should validate objectiveId as UUID when provided', async () => {
      const invalidUUID = '12345';

      const request = new Request(
        'http://localhost/api/workspace/workspace-123/chat',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: mockChatId,
            message: {
              id: 'msg-1',
              role: 'user',
              parts: [{ type: 'text', text: 'Hello' }],
            },
            selectedVisibilityType: 'private',
            objectiveId: invalidUUID,
          }),
        },
      );

      const params = Promise.resolve({ workspaceId: mockWorkspaceId });

      const response = await POST(request, { params });

      expect(response.status).toBe(400);
    });
  });
});
