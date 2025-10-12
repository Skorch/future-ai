import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { Chat } from '@/components/chat';

// Mock the hooks and utilities
vi.mock('@ai-sdk/react', () => ({
  useChat: vi.fn(),
}));

vi.mock('@/hooks/use-chat-visibility', () => ({
  useChatVisibility: vi.fn(() => ({ visibilityType: 'private' })),
}));

vi.mock('@/hooks/use-artifact', () => ({
  useArtifactSelector: vi.fn(() => false),
}));

vi.mock('@/hooks/use-auto-resume', () => ({
  useAutoResume: vi.fn(),
}));

vi.mock('swr', () => ({
  default: vi.fn(() => ({ data: undefined })),
  useSWRConfig: vi.fn(() => ({ mutate: vi.fn() })),
}));

vi.mock('@/components/data-stream-provider', () => ({
  useDataStream: vi.fn(() => ({ setDataStream: vi.fn() })),
}));

vi.mock('@/lib/utils', () => ({
  generateUUID: vi.fn(() => 'test-uuid'),
  fetcher: vi.fn(),
  fetchWithErrorHandlers: vi.fn(),
}));

// Mock child components
vi.mock('@/components/chat-header', () => ({
  ChatHeader: () => <div data-testid="chat-header">Chat Header</div>,
}));

vi.mock('@/components/messages', () => ({
  Messages: () => <div data-testid="messages">Messages</div>,
}));

vi.mock('@/components/multimodal-input', () => ({
  MultimodalInput: () => (
    <div data-testid="multimodal-input">Multimodal Input</div>
  ),
}));

vi.mock('@/components/artifact', () => ({
  Artifact: () => <div data-testid="artifact">Artifact</div>,
}));

vi.mock('@/components/toast', () => ({
  toast: vi.fn(),
}));

describe('Chat Component - Phase 4: ObjectiveId and Auto-Submit', () => {
  const defaultProps = {
    id: 'chat-123',
    workspaceId: 'workspace-456',
    initialMessages: [],
    initialVisibilityType: 'private' as const,
    isReadonly: false,
    autoResume: false,
    chat: null,
  };

  let mockSendMessage: ReturnType<typeof vi.fn>;
  let mockUseChatReturn: Record<string, unknown>;

  beforeEach(async () => {
    vi.clearAllMocks();

    mockSendMessage = vi.fn();

    mockUseChatReturn = {
      messages: [],
      setMessages: vi.fn(),
      sendMessage: mockSendMessage,
      status: 'awaiting_message',
      stop: vi.fn(),
      regenerate: vi.fn(),
      resumeStream: vi.fn(),
    };

    const { useChat } = vi.mocked(await import('@ai-sdk/react'));
    useChat.mockReturnValue(mockUseChatReturn as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('ObjectiveId Propagation', () => {
    it('should include objectiveId in API request when provided', () => {
      const objectiveId = 'objective-789';

      render(<Chat {...defaultProps} objectiveId={objectiveId} />);

      const { useChat } = require('@ai-sdk/react');
      const useChatCall = vi.mocked(useChat).mock.calls[0][0];

      // Check the transport prepareSendMessagesRequest function
      const prepareRequest = useChatCall.transport.prepareSendMessagesRequest;
      const result = prepareRequest({
        messages: [],
        id: 'chat-123',
        body: {},
      });

      expect(result.body.objectiveId).toBe(objectiveId);
    });

    it('should omit objectiveId from request when not provided', () => {
      render(<Chat {...defaultProps} />);

      const { useChat } = require('@ai-sdk/react');
      const useChatCall = vi.mocked(useChat).mock.calls[0][0];

      const prepareRequest = useChatCall.transport.prepareSendMessagesRequest;
      const result = prepareRequest({
        messages: [],
        id: 'chat-123',
        body: {},
      });

      expect(result.body.objectiveId).toBeUndefined();
    });

    it('should maintain objectiveId across multiple messages', () => {
      const { rerender } = render(
        <Chat {...defaultProps} objectiveId="objective-123" />,
      );

      // Simulate sending multiple messages
      rerender(<Chat {...defaultProps} objectiveId="objective-123" />);

      const { useChat } = require('@ai-sdk/react');
      const useChatCall = vi.mocked(useChat).mock.calls[0][0];

      const prepareRequest = useChatCall.transport.prepareSendMessagesRequest;
      const result = prepareRequest({
        messages: [{}, {}],
        id: 'chat-123',
        body: {},
      });

      expect(result.body.objectiveId).toBe('objective-123');
    });

    it('should use correct API endpoint with workspaceId', () => {
      render(<Chat {...defaultProps} workspaceId="workspace-999" />);

      const { useChat } = require('@ai-sdk/react');
      const useChatCall = vi.mocked(useChat).mock.calls[0][0];

      expect(useChatCall.transport.api).toBe(
        '/api/workspace/workspace-999/chat',
      );
    });
  });

  describe('Auto-Submit Logic', () => {
    beforeEach(() => {
      // Reset timers for useEffect testing
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should auto-send message when initialQuery and shouldAutoSubmit are both true', async () => {
      const initialQuery = 'Summarize this document';

      render(
        <Chat
          {...defaultProps}
          initialQuery={initialQuery}
          shouldAutoSubmit={true}
        />,
      );

      // Run useEffect
      await vi.runAllTimersAsync();

      await waitFor(() => {
        expect(mockSendMessage).toHaveBeenCalledWith({
          role: 'user',
          parts: [{ type: 'text', text: initialQuery }],
        });
      });
    });

    it('should NOT auto-send when shouldAutoSubmit is false', async () => {
      render(
        <Chat
          {...defaultProps}
          initialQuery="Test query"
          shouldAutoSubmit={false}
        />,
      );

      await vi.runAllTimersAsync();

      expect(mockSendMessage).not.toHaveBeenCalled();
    });

    it('should NOT auto-send when initialQuery is missing', async () => {
      render(<Chat {...defaultProps} shouldAutoSubmit={true} />);

      await vi.runAllTimersAsync();

      expect(mockSendMessage).not.toHaveBeenCalled();
    });

    it('should NOT auto-send when both initialQuery and shouldAutoSubmit are missing', async () => {
      render(<Chat {...defaultProps} />);

      await vi.runAllTimersAsync();

      expect(mockSendMessage).not.toHaveBeenCalled();
    });

    it('should only auto-send once (hasAppendedQuery flag)', async () => {
      const { rerender } = render(
        <Chat {...defaultProps} initialQuery="Test" shouldAutoSubmit={true} />,
      );

      await vi.runAllTimersAsync();

      // First call should happen
      expect(mockSendMessage).toHaveBeenCalledTimes(1);

      // Rerender with same props
      rerender(
        <Chat {...defaultProps} initialQuery="Test" shouldAutoSubmit={true} />,
      );

      await vi.runAllTimersAsync();

      // Should still be only 1 call (flag prevents duplicate)
      expect(mockSendMessage).toHaveBeenCalledTimes(1);
    });

    it('should clean URL after sending (replaceState)', async () => {
      const replaceStateSpy = vi.spyOn(window.history, 'replaceState');

      render(
        <Chat
          {...defaultProps}
          id="chat-456"
          workspaceId="workspace-789"
          initialQuery="Test query"
          shouldAutoSubmit={true}
        />,
      );

      await vi.runAllTimersAsync();

      await waitFor(() => {
        expect(replaceStateSpy).toHaveBeenCalledWith(
          {},
          '',
          '/workspace/workspace-789/chat/chat-456',
        );
      });

      replaceStateSpy.mockRestore();
    });

    it('should send message with correct structure', async () => {
      const testQuery = 'Analyze this content';

      render(
        <Chat
          {...defaultProps}
          initialQuery={testQuery}
          shouldAutoSubmit={true}
        />,
      );

      await vi.runAllTimersAsync();

      await waitFor(() => {
        expect(mockSendMessage).toHaveBeenCalledWith({
          role: 'user',
          parts: [{ type: 'text', text: testQuery }],
        });
      });
    });
  });

  describe('Combined ObjectiveId and Auto-Submit', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should include objectiveId in request when auto-submitting', async () => {
      render(
        <Chat
          {...defaultProps}
          objectiveId="objective-123"
          initialQuery="Test"
          shouldAutoSubmit={true}
        />,
      );

      await vi.runAllTimersAsync();

      // Verify sendMessage was called
      await waitFor(() => {
        expect(mockSendMessage).toHaveBeenCalled();
      });

      // Verify objectiveId is in the request body
      const { useChat } = require('@ai-sdk/react');
      const useChatCall = vi.mocked(useChat).mock.calls[0][0];
      const prepareRequest = useChatCall.transport.prepareSendMessagesRequest;
      const result = prepareRequest({
        messages: [],
        id: 'chat-123',
        body: {},
      });

      expect(result.body.objectiveId).toBe('objective-123');
    });

    it('should work with all Phase 4 props together', async () => {
      const replaceStateSpy = vi.spyOn(window.history, 'replaceState');

      render(
        <Chat
          {...defaultProps}
          objectiveId="objective-999"
          initialQuery="Complete summary of uploaded document"
          shouldAutoSubmit={true}
        />,
      );

      await vi.runAllTimersAsync();

      // Should auto-send
      await waitFor(() => {
        expect(mockSendMessage).toHaveBeenCalledWith({
          role: 'user',
          parts: [
            { type: 'text', text: 'Complete summary of uploaded document' },
          ],
        });
      });

      // Should clean URL
      expect(replaceStateSpy).toHaveBeenCalled();

      // Should include objectiveId in requests
      const { useChat } = require('@ai-sdk/react');
      const useChatCall = vi.mocked(useChat).mock.calls[0][0];
      const prepareRequest = useChatCall.transport.prepareSendMessagesRequest;
      const result = prepareRequest({
        messages: [],
        id: 'chat-123',
        body: {},
      });

      expect(result.body.objectiveId).toBe('objective-999');

      replaceStateSpy.mockRestore();
    });
  });

  describe('Backward Compatibility', () => {
    it('should work without any Phase 4 props', () => {
      const { container } = render(<Chat {...defaultProps} />);

      // Should render without errors
      expect(container).toBeDefined();
      expect(screen.getByTestId('chat-header')).toBeInTheDocument();
      expect(screen.getByTestId('messages')).toBeInTheDocument();
    });

    it('should work with only objectiveId', () => {
      const { container } = render(
        <Chat {...defaultProps} objectiveId="objective-123" />,
      );

      expect(container).toBeDefined();

      const { useChat } = require('@ai-sdk/react');
      const useChatCall = vi.mocked(useChat).mock.calls[0][0];
      const prepareRequest = useChatCall.transport.prepareSendMessagesRequest;
      const result = prepareRequest({
        messages: [],
        id: 'chat-123',
        body: {},
      });

      expect(result.body.objectiveId).toBe('objective-123');
    });

    it('should work with only initialQuery', async () => {
      vi.useFakeTimers();

      render(<Chat {...defaultProps} initialQuery="Test query" />);

      await vi.runAllTimersAsync();

      // Should not auto-send (shouldAutoSubmit defaults to false)
      expect(mockSendMessage).not.toHaveBeenCalled();

      vi.useRealTimers();
    });

    it('should default shouldAutoSubmit to false when undefined', async () => {
      vi.useFakeTimers();

      render(
        <Chat
          {...defaultProps}
          initialQuery="Test"
          shouldAutoSubmit={undefined}
        />,
      );

      await vi.runAllTimersAsync();

      expect(mockSendMessage).not.toHaveBeenCalled();

      vi.useRealTimers();
    });
  });

  describe('Edge Cases', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should handle very long initialQuery strings', async () => {
      const longQuery = 'a'.repeat(10000);

      render(
        <Chat
          {...defaultProps}
          initialQuery={longQuery}
          shouldAutoSubmit={true}
        />,
      );

      await vi.runAllTimersAsync();

      await waitFor(() => {
        expect(mockSendMessage).toHaveBeenCalledWith({
          role: 'user',
          parts: [{ type: 'text', text: longQuery }],
        });
      });
    });

    it('should handle special characters in initialQuery', async () => {
      const queryWithSpecialChars =
        'Summary: Q4 Sales & Marketing @ 100% <test>';

      render(
        <Chat
          {...defaultProps}
          initialQuery={queryWithSpecialChars}
          shouldAutoSubmit={true}
        />,
      );

      await vi.runAllTimersAsync();

      await waitFor(() => {
        expect(mockSendMessage).toHaveBeenCalledWith({
          role: 'user',
          parts: [{ type: 'text', text: queryWithSpecialChars }],
        });
      });
    });

    it('should handle empty string initialQuery', async () => {
      render(
        <Chat {...defaultProps} initialQuery="" shouldAutoSubmit={true} />,
      );

      await vi.runAllTimersAsync();

      // Empty string is falsy, should not auto-send
      expect(mockSendMessage).not.toHaveBeenCalled();
    });

    it('should handle whitespace-only initialQuery', async () => {
      render(
        <Chat
          {...defaultProps}
          initialQuery="   \n\n   "
          shouldAutoSubmit={true}
        />,
      );

      await vi.runAllTimersAsync();

      // Should still send (no trimming in auto-submit logic)
      await waitFor(() => {
        expect(mockSendMessage).toHaveBeenCalledWith({
          role: 'user',
          parts: [{ type: 'text', text: '   \n\n   ' }],
        });
      });
    });

    it('should handle changing objectiveId mid-session', () => {
      const { rerender } = render(
        <Chat {...defaultProps} objectiveId="objective-1" />,
      );

      rerender(<Chat {...defaultProps} objectiveId="objective-2" />);

      const { useChat } = require('@ai-sdk/react');
      // Get the latest call
      const latestCall =
        vi.mocked(useChat).mock.calls[
          vi.mocked(useChat).mock.calls.length - 1
        ][0];

      const prepareRequest = latestCall.transport.prepareSendMessagesRequest;
      const result = prepareRequest({
        messages: [],
        id: 'chat-123',
        body: {},
      });

      // Should use the new objectiveId
      expect(result.body.objectiveId).toBe('objective-2');
    });

    it('should handle multiple chat instances with different objectiveIds', () => {
      const { container: container1 } = render(
        <Chat {...defaultProps} id="chat-1" objectiveId="objective-1" />,
      );

      const { container: container2 } = render(
        <Chat {...defaultProps} id="chat-2" objectiveId="objective-2" />,
      );

      expect(container1).toBeDefined();
      expect(container2).toBeDefined();

      // Both should have their respective objectiveIds
      const { useChat } = require('@ai-sdk/react');
      const calls = vi.mocked(useChat).mock.calls;

      expect(calls.length).toBe(2);

      // First chat
      const prepareRequest1 = calls[0][0].transport.prepareSendMessagesRequest;
      const result1 = prepareRequest1({
        messages: [],
        id: 'chat-1',
        body: {},
      });
      expect(result1.body.objectiveId).toBe('objective-1');

      // Second chat
      const prepareRequest2 = calls[1][0].transport.prepareSendMessagesRequest;
      const result2 = prepareRequest2({
        messages: [],
        id: 'chat-2',
        body: {},
      });
      expect(result2.body.objectiveId).toBe('objective-2');
    });
  });

  describe('Props Validation', () => {
    it('should accept all Phase 4 props with correct types', () => {
      const props = {
        ...defaultProps,
        objectiveId: 'objective-123',
        initialQuery: 'Test query',
        shouldAutoSubmit: true,
      };

      const { container } = render(<Chat {...props} />);

      expect(container).toBeDefined();
    });

    it('should accept undefined for optional Phase 4 props', () => {
      const props = {
        ...defaultProps,
        objectiveId: undefined,
        initialQuery: undefined,
        shouldAutoSubmit: undefined,
      };

      const { container } = render(<Chat {...props} />);

      expect(container).toBeDefined();
    });
  });
});
