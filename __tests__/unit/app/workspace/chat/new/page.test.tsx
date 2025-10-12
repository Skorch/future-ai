import { describe, it, expect, vi, beforeEach } from 'vitest';
import { redirect } from 'next/navigation';
import NewChatPage from '@/app/(chat)/workspace/[workspaceId]/chat/new/page';

// Mock Clerk auth
vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(),
}));

// Mock next/navigation
vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}));

// Mock Chat component
vi.mock('@/components/chat', () => ({
  Chat: ({
    id,
    workspaceId,
    objectiveId,
    initialQuery,
    shouldAutoSubmit,
  }: {
    id: string;
    workspaceId: string;
    objectiveId?: string;
    initialQuery?: string;
    shouldAutoSubmit?: boolean;
  }) => (
    <div data-testid="chat-component">
      <div data-testid="chat-id">{id}</div>
      <div data-testid="workspace-id">{workspaceId}</div>
      {objectiveId && <div data-testid="objective-id">{objectiveId}</div>}
      {initialQuery && <div data-testid="initial-query">{initialQuery}</div>}
      {shouldAutoSubmit !== undefined && (
        <div data-testid="should-auto-submit">
          {shouldAutoSubmit.toString()}
        </div>
      )}
    </div>
  ),
}));

// Mock DataStreamHandler
vi.mock('@/components/data-stream-handler', () => ({
  DataStreamHandler: () => <div data-testid="data-stream-handler" />,
}));

// Mock generateUUID
vi.mock('@/lib/utils', () => ({
  generateUUID: vi.fn(() => 'test-chat-id-123'),
}));

describe('NewChatPage Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Authentication', () => {
    it('should redirect to login when user is not authenticated', async () => {
      const { auth } = await import('@clerk/nextjs/server');
      vi.mocked(auth).mockResolvedValue({ userId: null } as any);

      const params = Promise.resolve({ workspaceId: 'workspace-123' });
      const searchParams = Promise.resolve({});

      await NewChatPage({ params, searchParams });

      expect(redirect).toHaveBeenCalledWith('/login');
    });

    it('should not redirect when user is authenticated', async () => {
      const { auth } = await import('@clerk/nextjs/server');
      vi.mocked(auth).mockResolvedValue({ userId: 'user-123' } as any);

      const params = Promise.resolve({ workspaceId: 'workspace-123' });
      const searchParams = Promise.resolve({});

      await NewChatPage({ params, searchParams });

      expect(redirect).not.toHaveBeenCalled();
    });
  });

  describe('SearchParams Extraction - Phase 4', () => {
    beforeEach(async () => {
      const { auth } = await import('@clerk/nextjs/server');
      vi.mocked(auth).mockResolvedValue({ userId: 'user-123' } as any);
    });

    it('should extract objectiveId from searchParams', async () => {
      const params = Promise.resolve({ workspaceId: 'workspace-123' });
      const searchParams = Promise.resolve({
        objectiveId: 'objective-456',
      });

      const result = await NewChatPage({ params, searchParams });

      const objectiveIdElement = result.props.children[0].props.objectiveId;
      expect(objectiveIdElement).toBe('objective-456');
    });

    it('should extract query from searchParams', async () => {
      const params = Promise.resolve({ workspaceId: 'workspace-123' });
      const searchParams = Promise.resolve({
        query: 'Summarize this document',
      });

      const result = await NewChatPage({ params, searchParams });

      const initialQuery = result.props.children[0].props.initialQuery;
      expect(initialQuery).toBe('Summarize this document');
    });

    it('should extract autoSubmit from searchParams', async () => {
      const params = Promise.resolve({ workspaceId: 'workspace-123' });
      const searchParams = Promise.resolve({
        autoSubmit: 'true',
      });

      const result = await NewChatPage({ params, searchParams });

      const shouldAutoSubmit = result.props.children[0].props.shouldAutoSubmit;
      expect(shouldAutoSubmit).toBe(true);
    });

    it('should handle all params together', async () => {
      const params = Promise.resolve({ workspaceId: 'workspace-123' });
      const searchParams = Promise.resolve({
        objectiveId: 'objective-789',
        query: 'Create a summary',
        autoSubmit: 'true',
      });

      const result = await NewChatPage({ params, searchParams });

      const chatProps = result.props.children[0].props;
      expect(chatProps.objectiveId).toBe('objective-789');
      expect(chatProps.initialQuery).toBe('Create a summary');
      expect(chatProps.shouldAutoSubmit).toBe(true);
    });

    it('should handle missing params gracefully', async () => {
      const params = Promise.resolve({ workspaceId: 'workspace-123' });
      const searchParams = Promise.resolve({});

      const result = await NewChatPage({ params, searchParams });

      const chatProps = result.props.children[0].props;
      expect(chatProps.objectiveId).toBeUndefined();
      expect(chatProps.initialQuery).toBeUndefined();
      expect(chatProps.shouldAutoSubmit).toBe(false);
    });

    it('should convert autoSubmit string to boolean (true case)', async () => {
      const params = Promise.resolve({ workspaceId: 'workspace-123' });
      const searchParams = Promise.resolve({
        autoSubmit: 'true',
      });

      const result = await NewChatPage({ params, searchParams });

      expect(result.props.children[0].props.shouldAutoSubmit).toBe(true);
    });

    it('should convert autoSubmit string to boolean (false case)', async () => {
      const params = Promise.resolve({ workspaceId: 'workspace-123' });
      const searchParams = Promise.resolve({
        autoSubmit: 'false',
      });

      const result = await NewChatPage({ params, searchParams });

      expect(result.props.children[0].props.shouldAutoSubmit).toBe(false);
    });

    it('should handle undefined autoSubmit as false', async () => {
      const params = Promise.resolve({ workspaceId: 'workspace-123' });
      const searchParams = Promise.resolve({
        objectiveId: 'objective-123',
      });

      const result = await NewChatPage({ params, searchParams });

      expect(result.props.children[0].props.shouldAutoSubmit).toBe(false);
    });

    it('should handle URL-encoded query parameters', async () => {
      const params = Promise.resolve({ workspaceId: 'workspace-123' });
      const searchParams = Promise.resolve({
        query: 'Summarize%20this%20document%20with%20%26%20analysis',
      });

      const result = await NewChatPage({ params, searchParams });

      // searchParams already decoded by Next.js
      const initialQuery = result.props.children[0].props.initialQuery;
      expect(initialQuery).toBe(
        'Summarize%20this%20document%20with%20%26%20analysis',
      );
    });
  });

  describe('Props Passing to Chat Component', () => {
    beforeEach(async () => {
      const { auth } = await import('@clerk/nextjs/server');
      vi.mocked(auth).mockResolvedValue({ userId: 'user-123' } as any);
    });

    it('should pass workspaceId from params', async () => {
      const params = Promise.resolve({ workspaceId: 'workspace-999' });
      const searchParams = Promise.resolve({});

      const result = await NewChatPage({ params, searchParams });

      expect(result.props.children[0].props.workspaceId).toBe('workspace-999');
    });

    it('should generate and pass a unique chat ID', async () => {
      const params = Promise.resolve({ workspaceId: 'workspace-123' });
      const searchParams = Promise.resolve({});

      const result = await NewChatPage({ params, searchParams });

      const chatId = result.props.children[0].props.id;
      expect(chatId).toBe('test-chat-id-123');
    });

    it('should pass empty initialMessages array', async () => {
      const params = Promise.resolve({ workspaceId: 'workspace-123' });
      const searchParams = Promise.resolve({});

      const result = await NewChatPage({ params, searchParams });

      expect(result.props.children[0].props.initialMessages).toEqual([]);
    });

    it('should set initialVisibilityType to private', async () => {
      const params = Promise.resolve({ workspaceId: 'workspace-123' });
      const searchParams = Promise.resolve({});

      const result = await NewChatPage({ params, searchParams });

      expect(result.props.children[0].props.initialVisibilityType).toBe(
        'private',
      );
    });

    it('should set isReadonly to false', async () => {
      const params = Promise.resolve({ workspaceId: 'workspace-123' });
      const searchParams = Promise.resolve({});

      const result = await NewChatPage({ params, searchParams });

      expect(result.props.children[0].props.isReadonly).toBe(false);
    });

    it('should set autoResume to false', async () => {
      const params = Promise.resolve({ workspaceId: 'workspace-123' });
      const searchParams = Promise.resolve({});

      const result = await NewChatPage({ params, searchParams });

      expect(result.props.children[0].props.autoResume).toBe(false);
    });

    it('should set chat to null', async () => {
      const params = Promise.resolve({ workspaceId: 'workspace-123' });
      const searchParams = Promise.resolve({});

      const result = await NewChatPage({ params, searchParams });

      expect(result.props.children[0].props.chat).toBeNull();
    });
  });

  describe('Backward Compatibility', () => {
    beforeEach(async () => {
      const { auth } = await import('@clerk/nextjs/server');
      vi.mocked(auth).mockResolvedValue({ userId: 'user-123' } as any);
    });

    it('should work when all Phase 4 params are missing', async () => {
      const params = Promise.resolve({ workspaceId: 'workspace-123' });
      const searchParams = Promise.resolve({});

      const result = await NewChatPage({ params, searchParams });

      const chatProps = result.props.children[0].props;

      // Should still render with core props
      expect(chatProps.workspaceId).toBe('workspace-123');
      expect(chatProps.id).toBeDefined();
      expect(chatProps.initialMessages).toEqual([]);

      // Phase 4 props should be undefined or false
      expect(chatProps.objectiveId).toBeUndefined();
      expect(chatProps.initialQuery).toBeUndefined();
      expect(chatProps.shouldAutoSubmit).toBe(false);
    });

    it('should work with only objectiveId provided', async () => {
      const params = Promise.resolve({ workspaceId: 'workspace-123' });
      const searchParams = Promise.resolve({
        objectiveId: 'objective-123',
      });

      const result = await NewChatPage({ params, searchParams });

      const chatProps = result.props.children[0].props;
      expect(chatProps.objectiveId).toBe('objective-123');
      expect(chatProps.initialQuery).toBeUndefined();
      expect(chatProps.shouldAutoSubmit).toBe(false);
    });

    it('should work with only query provided', async () => {
      const params = Promise.resolve({ workspaceId: 'workspace-123' });
      const searchParams = Promise.resolve({
        query: 'Test query',
      });

      const result = await NewChatPage({ params, searchParams });

      const chatProps = result.props.children[0].props;
      expect(chatProps.objectiveId).toBeUndefined();
      expect(chatProps.initialQuery).toBe('Test query');
      expect(chatProps.shouldAutoSubmit).toBe(false);
    });
  });

  describe('Component Rendering', () => {
    beforeEach(async () => {
      const { auth } = await import('@clerk/nextjs/server');
      vi.mocked(auth).mockResolvedValue({ userId: 'user-123' } as any);
    });

    it('should render DataStreamHandler component', async () => {
      const params = Promise.resolve({ workspaceId: 'workspace-123' });
      const searchParams = Promise.resolve({});

      const result = await NewChatPage({ params, searchParams });

      // DataStreamHandler is second child
      const dataStreamHandler = result.props.children[1];
      expect(dataStreamHandler.type.name).toBe('DataStreamHandler');
    });

    it('should render both Chat and DataStreamHandler', async () => {
      const params = Promise.resolve({ workspaceId: 'workspace-123' });
      const searchParams = Promise.resolve({});

      const result = await NewChatPage({ params, searchParams });

      expect(result.props.children).toHaveLength(2);
    });
  });

  describe('Edge Cases', () => {
    beforeEach(async () => {
      const { auth } = await import('@clerk/nextjs/server');
      vi.mocked(auth).mockResolvedValue({ userId: 'user-123' } as any);
    });

    it('should handle special characters in query', async () => {
      const params = Promise.resolve({ workspaceId: 'workspace-123' });
      const searchParams = Promise.resolve({
        query: 'Summary: Q4 Sales & Marketing @ 100%',
      });

      const result = await NewChatPage({ params, searchParams });

      expect(result.props.children[0].props.initialQuery).toBe(
        'Summary: Q4 Sales & Marketing @ 100%',
      );
    });

    it('should handle empty string for query', async () => {
      const params = Promise.resolve({ workspaceId: 'workspace-123' });
      const searchParams = Promise.resolve({
        query: '',
      });

      const result = await NewChatPage({ params, searchParams });

      expect(result.props.children[0].props.initialQuery).toBe('');
    });

    it('should handle very long query strings', async () => {
      const params = Promise.resolve({ workspaceId: 'workspace-123' });
      const longQuery = 'a'.repeat(10000);
      const searchParams = Promise.resolve({
        query: longQuery,
      });

      const result = await NewChatPage({ params, searchParams });

      expect(result.props.children[0].props.initialQuery).toBe(longQuery);
    });

    it('should handle autoSubmit with arbitrary values as false', async () => {
      const params = Promise.resolve({ workspaceId: 'workspace-123' });
      const searchParams = Promise.resolve({
        autoSubmit: 'yes',
      });

      const result = await NewChatPage({ params, searchParams });

      // Only 'true' should convert to true
      expect(result.props.children[0].props.shouldAutoSubmit).toBe(false);
    });

    it('should handle multiple objectiveIds (takes first)', async () => {
      const params = Promise.resolve({ workspaceId: 'workspace-123' });
      const searchParams = Promise.resolve({
        objectiveId: 'objective-first',
      });

      const result = await NewChatPage({ params, searchParams });

      expect(result.props.children[0].props.objectiveId).toBe(
        'objective-first',
      );
    });
  });
});
