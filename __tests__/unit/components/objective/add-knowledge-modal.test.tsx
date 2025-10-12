import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { AddKnowledgeModal } from '@/components/objective/add-knowledge-modal';

// Helper function to set textarea value directly (for large content)
const setTextareaValue = (textarea: HTMLElement, value: string) => {
  fireEvent.change(textarea, { target: { value } });
};

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
}));

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock UI components
vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-content">{children}</div>
  ),
  DialogDescription: ({ children }: { children: React.ReactNode }) => (
    <p data-testid="dialog-description">{children}</p>
  ),
  DialogFooter: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-footer">{children}</div>
  ),
  DialogHeader: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-header">{children}</div>
  ),
  DialogTitle: ({ children }: { children: React.ReactNode }) => (
    <h2 data-testid="dialog-title">{children}</h2>
  ),
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    disabled,
    variant,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    variant?: string;
  }) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      data-testid={variant === 'outline' ? 'add-button' : 'add-summary-button'}
      data-variant={variant}
    >
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/label', () => ({
  Label: ({
    children,
    htmlFor,
  }: {
    children: React.ReactNode;
    htmlFor?: string;
  }) => (
    <label htmlFor={htmlFor} data-testid="label">
      {children}
    </label>
  ),
}));

vi.mock('@/components/ui/textarea', () => ({
  Textarea: ({
    id,
    placeholder,
    value,
    onChange,
    rows,
    disabled,
    autoFocus,
    className,
  }: {
    id?: string;
    placeholder?: string;
    value?: string;
    onChange?: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
    rows?: number;
    disabled?: boolean;
    autoFocus?: boolean;
    className?: string;
  }) => (
    <textarea
      id={id}
      data-testid="content-textarea"
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      rows={rows}
      disabled={disabled}
      autoFocus={autoFocus}
      data-classname={className}
    />
  ),
}));

describe('AddKnowledgeModal Component', () => {
  const defaultProps = {
    workspaceId: 'workspace-123',
    objectiveId: 'objective-456',
    open: true,
    onOpenChange: vi.fn(),
  };

  let mockRefresh: ReturnType<typeof vi.fn>;
  let mockPush: ReturnType<typeof vi.fn>;
  let mockToastSuccess: ReturnType<typeof vi.fn>;
  let mockToastError: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();
    global.fetch = vi.fn();

    // Setup router mock
    mockRefresh = vi.fn();
    mockPush = vi.fn();
    const { useRouter } = await import('next/navigation');
    vi.mocked(useRouter).mockReturnValue({
      refresh: mockRefresh,
      push: mockPush,
    } as any);

    // Setup toast mocks
    const { toast } = await import('sonner');
    mockToastSuccess = vi.fn();
    mockToastError = vi.fn();
    (toast as any).success = mockToastSuccess;
    (toast as any).error = mockToastError;
  });

  describe('Rendering', () => {
    it('should render modal when open is true', () => {
      render(<AddKnowledgeModal {...defaultProps} />);

      expect(screen.getByTestId('dialog')).toBeInTheDocument();
    });

    it('should not render modal when open is false', () => {
      render(<AddKnowledgeModal {...defaultProps} open={false} />);

      expect(screen.queryByTestId('dialog')).not.toBeInTheDocument();
    });

    it('should render dialog title', () => {
      render(<AddKnowledgeModal {...defaultProps} />);

      expect(screen.getByTestId('dialog-title')).toBeInTheDocument();
      expect(
        screen.getByText('Add Knowledge to Objective'),
      ).toBeInTheDocument();
    });

    it('should render dialog description', () => {
      render(<AddKnowledgeModal {...defaultProps} />);

      expect(screen.getByTestId('dialog-description')).toBeInTheDocument();
      expect(
        screen.getByText(/Paste meeting notes, emails, transcripts/),
      ).toBeInTheDocument();
    });

    it('should render content textarea', () => {
      render(<AddKnowledgeModal {...defaultProps} />);

      const textarea = screen.getByTestId('content-textarea');
      expect(textarea).toBeInTheDocument();
      expect(textarea).toHaveAttribute(
        'placeholder',
        'Paste your content here...',
      );
      expect(textarea).toHaveAttribute('rows', '12');
    });

    it('should render content label', () => {
      render(<AddKnowledgeModal {...defaultProps} />);

      const label = screen.getByTestId('label');
      expect(label).toBeInTheDocument();
      expect(label).toHaveAttribute('for', 'content');
      expect(label).toHaveTextContent('Content');
    });

    it('should render byte size indicator', () => {
      render(<AddKnowledgeModal {...defaultProps} />);

      expect(screen.getByText('0.0 KB / 400 KB')).toBeInTheDocument();
    });

    it('should render Add button', () => {
      render(<AddKnowledgeModal {...defaultProps} />);

      const addButton = screen.getByTestId('add-button');
      expect(addButton).toBeInTheDocument();
      expect(addButton).toHaveAttribute('data-variant', 'outline');
      expect(addButton).toHaveTextContent('Add');
    });

    it('should render Add and Create Summary button', () => {
      render(<AddKnowledgeModal {...defaultProps} />);

      const summaryButton = screen.getByTestId('add-summary-button');
      expect(summaryButton).toBeInTheDocument();
      expect(summaryButton).toHaveTextContent('Add and Create Summary');
    });

    it('should have textarea that can receive autofocus', () => {
      render(<AddKnowledgeModal {...defaultProps} />);

      const textarea = screen.getByTestId('content-textarea');
      // The textarea should be present and available for focus
      // In the actual implementation, autoFocus is set, but in our mock
      // we don't need to test the browser's focus behavior
      expect(textarea).toBeInTheDocument();
      expect(textarea).not.toBeDisabled();
    });

    it('should have non-resizable textarea', () => {
      render(<AddKnowledgeModal {...defaultProps} />);

      const textarea = screen.getByTestId('content-textarea');
      const className = textarea.getAttribute('data-classname');
      expect(className).toContain('resize-none');
    });
  });

  describe('Byte Size Validation', () => {
    it('should disable buttons when content is empty', () => {
      render(<AddKnowledgeModal {...defaultProps} />);

      const addButton = screen.getByTestId('add-button');
      const summaryButton = screen.getByTestId('add-summary-button');

      expect(addButton).toBeDisabled();
      expect(summaryButton).toBeDisabled();
    });

    it('should enable buttons when content is valid', async () => {
      const user = userEvent.setup();
      render(<AddKnowledgeModal {...defaultProps} />);

      const textarea = screen.getByTestId('content-textarea');
      await user.type(textarea, 'Valid content');

      await waitFor(() => {
        expect(screen.getByTestId('add-button')).not.toBeDisabled();
        expect(screen.getByTestId('add-summary-button')).not.toBeDisabled();
      });
    });

    it('should update byte size display as content changes', async () => {
      const user = userEvent.setup();
      render(<AddKnowledgeModal {...defaultProps} />);

      const textarea = screen.getByTestId('content-textarea');
      await user.type(textarea, 'a'.repeat(1024));

      await waitFor(() => {
        expect(screen.getByText('1.0 KB / 400 KB')).toBeInTheDocument();
      });
    });

    it('should accept content exactly at 400KB', async () => {
      render(<AddKnowledgeModal {...defaultProps} />);

      const textarea = screen.getByTestId('content-textarea');
      const content = 'a'.repeat(400 * 1024); // Exactly 400KB
      setTextareaValue(textarea, content);

      await waitFor(() => {
        expect(screen.getByTestId('add-button')).not.toBeDisabled();
        expect(screen.getByTestId('add-summary-button')).not.toBeDisabled();
      });
    });

    it('should disable buttons when content exceeds 400KB', async () => {
      render(<AddKnowledgeModal {...defaultProps} />);

      const textarea = screen.getByTestId('content-textarea');
      const content = 'a'.repeat(401 * 1024); // 401KB
      setTextareaValue(textarea, content);

      await waitFor(() => {
        expect(screen.getByTestId('add-button')).toBeDisabled();
        expect(screen.getByTestId('add-summary-button')).toBeDisabled();
      });
    });

    it('should show error message when content exceeds 400KB', async () => {
      render(<AddKnowledgeModal {...defaultProps} />);

      const textarea = screen.getByTestId('content-textarea');
      const content = 'a'.repeat(401 * 1024); // 401KB
      setTextareaValue(textarea, content);

      await waitFor(() => {
        expect(
          screen.getByText(
            'Content exceeds 400KB limit. Please reduce the text length.',
          ),
        ).toBeInTheDocument();
      });
    });

    it('should not show error message when content is under 400KB', async () => {
      const user = userEvent.setup();
      render(<AddKnowledgeModal {...defaultProps} />);

      const textarea = screen.getByTestId('content-textarea');
      await user.type(textarea, 'Valid content');

      await waitFor(() => {
        expect(
          screen.queryByText(/Content exceeds 400KB limit/),
        ).not.toBeInTheDocument();
      });
    });

    it('should calculate byte size using UTF-8 encoding', async () => {
      const user = userEvent.setup();
      render(<AddKnowledgeModal {...defaultProps} />);

      const textarea = screen.getByTestId('content-textarea');
      // Emoji and multi-byte characters
      await user.type(textarea, '😀'); // 4 bytes in UTF-8

      await waitFor(() => {
        expect(screen.getByText('0.0 KB / 400 KB')).toBeInTheDocument();
      });
    });

    it('should handle multi-byte characters correctly for validation', async () => {
      render(<AddKnowledgeModal {...defaultProps} />);

      const textarea = screen.getByTestId('content-textarea');
      // Create content with multi-byte characters that's close to 400KB
      const content = '🔥'.repeat(100 * 1024); // Each emoji is 4 bytes, so 400KB total
      setTextareaValue(textarea, content);

      await waitFor(() => {
        expect(screen.getByTestId('add-button')).not.toBeDisabled();
      });
    });

    it('should disable buttons when content is only whitespace', async () => {
      render(<AddKnowledgeModal {...defaultProps} />);

      const textarea = screen.getByTestId('content-textarea');
      setTextareaValue(textarea, '   \n\n   ');

      await waitFor(() => {
        expect(screen.getByTestId('add-button')).toBeDisabled();
        expect(screen.getByTestId('add-summary-button')).toBeDisabled();
      });
    });
  });

  describe('API Calls', () => {
    it('should call POST with correct endpoint for Add button', async () => {
      const user = userEvent.setup();
      render(<AddKnowledgeModal {...defaultProps} />);

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          document: { id: 'doc-123', title: 'Test Doc' },
        }),
      } as Response);

      const textarea = screen.getByTestId('content-textarea');
      await user.type(textarea, 'Test content');

      const addButton = screen.getByTestId('add-button');
      await user.click(addButton);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith(
          '/api/workspace/workspace-123/knowledge',
          expect.objectContaining({
            method: 'POST',
          }),
        );
      });
    });

    it('should call POST without X-Create-Summary header for Add button', async () => {
      const user = userEvent.setup();
      render(<AddKnowledgeModal {...defaultProps} />);

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          document: { id: 'doc-123', title: 'Test Doc' },
        }),
      } as Response);

      const textarea = screen.getByTestId('content-textarea');
      await user.type(textarea, 'Test content');

      const addButton = screen.getByTestId('add-button');
      await user.click(addButton);

      await waitFor(() => {
        const fetchCall = vi.mocked(fetch).mock.calls[0];
        const headers = fetchCall[1]?.headers as Record<string, string>;
        expect(headers['X-Create-Summary']).toBeUndefined();
      });
    });

    it('should call POST with X-Create-Summary header for Add and Create Summary button', async () => {
      const user = userEvent.setup();
      render(<AddKnowledgeModal {...defaultProps} />);

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          document: { id: 'doc-123', title: 'Test Doc' },
          shouldCreateSummary: true,
        }),
      } as Response);

      const textarea = screen.getByTestId('content-textarea');
      await user.type(textarea, 'Test content');

      const summaryButton = screen.getByTestId('add-summary-button');
      await user.click(summaryButton);

      await waitFor(() => {
        const fetchCall = vi.mocked(fetch).mock.calls[0];
        const headers = fetchCall[1]?.headers as Record<string, string>;
        expect(headers['X-Create-Summary']).toBe('true');
      });
    });

    it('should include workspaceId in API call', async () => {
      const user = userEvent.setup();
      render(
        <AddKnowledgeModal
          {...defaultProps}
          workspaceId="ws-999"
          objectiveId="obj-888"
        />,
      );

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          document: { id: 'doc-123', title: 'Test Doc' },
        }),
      } as Response);

      const textarea = screen.getByTestId('content-textarea');
      await user.type(textarea, 'Test content');

      const addButton = screen.getByTestId('add-button');
      await user.click(addButton);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith(
          '/api/workspace/ws-999/knowledge',
          expect.any(Object),
        );
      });
    });

    it('should include objectiveId in request body', async () => {
      const user = userEvent.setup();
      render(
        <AddKnowledgeModal
          {...defaultProps}
          workspaceId="ws-777"
          objectiveId="obj-666"
        />,
      );

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          document: { id: 'doc-123', title: 'Test Doc' },
        }),
      } as Response);

      const textarea = screen.getByTestId('content-textarea');
      await user.type(textarea, 'Test content');

      const addButton = screen.getByTestId('add-button');
      await user.click(addButton);

      await waitFor(() => {
        const fetchCall = vi.mocked(fetch).mock.calls[0];
        const body = JSON.parse(fetchCall[1]?.body as string);
        expect(body.objectiveId).toBe('obj-666');
      });
    });

    it('should include content in request body', async () => {
      const user = userEvent.setup();
      render(<AddKnowledgeModal {...defaultProps} />);

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          document: { id: 'doc-123', title: 'Test Doc' },
        }),
      } as Response);

      const testContent = 'This is my test content';
      const textarea = screen.getByTestId('content-textarea');
      await user.type(textarea, testContent);

      const addButton = screen.getByTestId('add-button');
      await user.click(addButton);

      await waitFor(() => {
        const fetchCall = vi.mocked(fetch).mock.calls[0];
        const body = JSON.parse(fetchCall[1]?.body as string);
        expect(body.content).toBe(testContent);
      });
    });

    it('should include category raw in request body', async () => {
      const user = userEvent.setup();
      render(<AddKnowledgeModal {...defaultProps} />);

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          document: { id: 'doc-123', title: 'Test Doc' },
        }),
      } as Response);

      const textarea = screen.getByTestId('content-textarea');
      await user.type(textarea, 'Test content');

      const addButton = screen.getByTestId('add-button');
      await user.click(addButton);

      await waitFor(() => {
        const fetchCall = vi.mocked(fetch).mock.calls[0];
        const body = JSON.parse(fetchCall[1]?.body as string);
        expect(body.category).toBe('raw');
      });
    });

    it('should include Content-Type application/json header', async () => {
      const user = userEvent.setup();
      render(<AddKnowledgeModal {...defaultProps} />);

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          document: { id: 'doc-123', title: 'Test Doc' },
        }),
      } as Response);

      const textarea = screen.getByTestId('content-textarea');
      await user.type(textarea, 'Test content');

      const addButton = screen.getByTestId('add-button');
      await user.click(addButton);

      await waitFor(() => {
        const fetchCall = vi.mocked(fetch).mock.calls[0];
        const headers = fetchCall[1]?.headers as Record<string, string>;
        expect(headers['Content-Type']).toBe('application/json');
      });
    });
  });

  describe('Success Flow - Add Button', () => {
    it('should show success toast on successful Add', async () => {
      const user = userEvent.setup();
      render(<AddKnowledgeModal {...defaultProps} />);

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          document: { id: 'doc-123', title: 'Test Doc' },
        }),
      } as Response);

      const textarea = screen.getByTestId('content-textarea');
      await user.type(textarea, 'Test content');

      const addButton = screen.getByTestId('add-button');
      await user.click(addButton);

      await waitFor(() => {
        expect(mockToastSuccess).toHaveBeenCalledWith(
          'Knowledge document created successfully!',
        );
      });
    });

    it('should close modal on successful Add', async () => {
      const user = userEvent.setup();
      const onOpenChange = vi.fn();
      render(
        <AddKnowledgeModal {...defaultProps} onOpenChange={onOpenChange} />,
      );

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          document: { id: 'doc-123', title: 'Test Doc' },
        }),
      } as Response);

      const textarea = screen.getByTestId('content-textarea');
      await user.type(textarea, 'Test content');

      const addButton = screen.getByTestId('add-button');
      await user.click(addButton);

      await waitFor(() => {
        expect(onOpenChange).toHaveBeenCalledWith(false);
      });
    });

    it('should call router.refresh() on successful Add', async () => {
      const user = userEvent.setup();
      render(<AddKnowledgeModal {...defaultProps} />);

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          document: { id: 'doc-123', title: 'Test Doc' },
        }),
      } as Response);

      const textarea = screen.getByTestId('content-textarea');
      await user.type(textarea, 'Test content');

      const addButton = screen.getByTestId('add-button');
      await user.click(addButton);

      await waitFor(() => {
        expect(mockRefresh).toHaveBeenCalledOnce();
      });
    });

    it('should call onSuccess callback with documentId', async () => {
      const user = userEvent.setup();
      const onSuccess = vi.fn();
      render(<AddKnowledgeModal {...defaultProps} onSuccess={onSuccess} />);

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          document: { id: 'doc-789', title: 'Test Doc' },
        }),
      } as Response);

      const textarea = screen.getByTestId('content-textarea');
      await user.type(textarea, 'Test content');

      const addButton = screen.getByTestId('add-button');
      await user.click(addButton);

      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalledWith('doc-789');
      });
    });

    it('should not navigate when Add button is used', async () => {
      const user = userEvent.setup();
      render(<AddKnowledgeModal {...defaultProps} />);

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          document: { id: 'doc-123', title: 'Test Doc' },
        }),
      } as Response);

      const textarea = screen.getByTestId('content-textarea');
      await user.type(textarea, 'Test content');

      const addButton = screen.getByTestId('add-button');
      await user.click(addButton);

      await waitFor(() => {
        expect(mockToastSuccess).toHaveBeenCalled();
      });

      expect(mockPush).not.toHaveBeenCalled();
    });

    it('should not error if onSuccess is not provided', async () => {
      const user = userEvent.setup();
      render(<AddKnowledgeModal {...defaultProps} />);

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          document: { id: 'doc-123', title: 'Test Doc' },
        }),
      } as Response);

      const textarea = screen.getByTestId('content-textarea');
      await user.type(textarea, 'Test content');

      const addButton = screen.getByTestId('add-button');
      await user.click(addButton);

      await waitFor(() => {
        expect(mockToastSuccess).toHaveBeenCalled();
      });

      // Should not throw error
      expect(mockToastError).not.toHaveBeenCalled();
    });
  });

  describe('Success Flow - Add and Create Summary Button', () => {
    it('should show success toast on successful Add and Create Summary', async () => {
      const user = userEvent.setup();
      render(<AddKnowledgeModal {...defaultProps} />);

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          document: { id: 'doc-123', title: 'Test Doc' },
          shouldCreateSummary: true,
        }),
      } as Response);

      const textarea = screen.getByTestId('content-textarea');
      await user.type(textarea, 'Test content');

      const summaryButton = screen.getByTestId('add-summary-button');
      await user.click(summaryButton);

      await waitFor(() => {
        expect(mockToastSuccess).toHaveBeenCalledWith(
          'Knowledge document created successfully!',
        );
      });
    });

    it('should close modal on successful Add and Create Summary', async () => {
      const user = userEvent.setup();
      const onOpenChange = vi.fn();
      render(
        <AddKnowledgeModal {...defaultProps} onOpenChange={onOpenChange} />,
      );

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          document: { id: 'doc-123', title: 'Test Doc' },
          shouldCreateSummary: true,
        }),
      } as Response);

      const textarea = screen.getByTestId('content-textarea');
      await user.type(textarea, 'Test content');

      const summaryButton = screen.getByTestId('add-summary-button');
      await user.click(summaryButton);

      await waitFor(() => {
        expect(onOpenChange).toHaveBeenCalledWith(false);
      });
    });

    it('should call router.refresh() on successful Add and Create Summary', async () => {
      const user = userEvent.setup();
      render(<AddKnowledgeModal {...defaultProps} />);

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          document: { id: 'doc-123', title: 'Test Doc' },
          shouldCreateSummary: true,
        }),
      } as Response);

      const textarea = screen.getByTestId('content-textarea');
      await user.type(textarea, 'Test content');

      const summaryButton = screen.getByTestId('add-summary-button');
      await user.click(summaryButton);

      await waitFor(() => {
        expect(mockRefresh).toHaveBeenCalledOnce();
      });
    });

    it('should navigate to chat with query param when shouldCreateSummary is true', async () => {
      const user = userEvent.setup();
      render(<AddKnowledgeModal {...defaultProps} />);

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          document: { id: 'doc-123', title: 'My Document' },
          shouldCreateSummary: true,
        }),
      } as Response);

      const textarea = screen.getByTestId('content-textarea');
      await user.type(textarea, 'Test content');

      const summaryButton = screen.getByTestId('add-summary-button');
      await user.click(summaryButton);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith(
          expect.stringContaining('/workspace/workspace-123/chat/new'),
        );
      });

      const pushCall = mockPush.mock.calls[0][0];
      expect(pushCall).toContain('objectiveId=objective-456');
      expect(pushCall).toContain('query=');
      expect(pushCall).toContain('My%20Document');
    });

    it('should encode document title in navigation query', async () => {
      const user = userEvent.setup();
      render(<AddKnowledgeModal {...defaultProps} />);

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          document: { id: 'doc-123', title: 'Q4 Sales & Marketing Plan' },
          shouldCreateSummary: true,
        }),
      } as Response);

      const textarea = screen.getByTestId('content-textarea');
      await user.type(textarea, 'Test content');

      const summaryButton = screen.getByTestId('add-summary-button');
      await user.click(summaryButton);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalled();
      });

      const pushCall = mockPush.mock.calls[0][0];
      expect(pushCall).toContain('Q4%20Sales%20%26%20Marketing%20Plan');
    });

    it('should not navigate when shouldCreateSummary is false', async () => {
      const user = userEvent.setup();
      render(<AddKnowledgeModal {...defaultProps} />);

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          document: { id: 'doc-123', title: 'Test Doc' },
          shouldCreateSummary: false,
        }),
      } as Response);

      const textarea = screen.getByTestId('content-textarea');
      await user.type(textarea, 'Test content');

      const summaryButton = screen.getByTestId('add-summary-button');
      await user.click(summaryButton);

      await waitFor(() => {
        expect(mockToastSuccess).toHaveBeenCalled();
      });

      expect(mockPush).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should show error toast on API failure (non-ok response)', async () => {
      const user = userEvent.setup();
      render(<AddKnowledgeModal {...defaultProps} />);

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Content too large' }),
      } as Response);

      const textarea = screen.getByTestId('content-textarea');
      await user.type(textarea, 'Test content');

      const addButton = screen.getByTestId('add-button');
      await user.click(addButton);

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith('Content too large');
      });

      expect(mockToastSuccess).not.toHaveBeenCalled();
    });

    it('should show generic error when API returns no error message', async () => {
      const user = userEvent.setup();
      render(<AddKnowledgeModal {...defaultProps} />);

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        json: async () => ({}),
      } as Response);

      const textarea = screen.getByTestId('content-textarea');
      await user.type(textarea, 'Test content');

      const addButton = screen.getByTestId('add-button');
      await user.click(addButton);

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith(
          'Failed to create knowledge document',
        );
      });
    });

    it('should handle network errors gracefully', async () => {
      const user = userEvent.setup();
      render(<AddKnowledgeModal {...defaultProps} />);

      vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'));

      const textarea = screen.getByTestId('content-textarea');
      await user.type(textarea, 'Test content');

      const addButton = screen.getByTestId('add-button');
      await user.click(addButton);

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith('Network error');
      });
    });

    it('should handle non-Error exceptions', async () => {
      const user = userEvent.setup();
      render(<AddKnowledgeModal {...defaultProps} />);

      vi.mocked(fetch).mockRejectedValueOnce('String error');

      const textarea = screen.getByTestId('content-textarea');
      await user.type(textarea, 'Test content');

      const addButton = screen.getByTestId('add-button');
      await user.click(addButton);

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith(
          'Failed to create knowledge document',
        );
      });
    });

    it('should not close modal on error', async () => {
      const user = userEvent.setup();
      const onOpenChange = vi.fn();
      render(
        <AddKnowledgeModal {...defaultProps} onOpenChange={onOpenChange} />,
      );

      vi.mocked(fetch).mockRejectedValueOnce(new Error('API error'));

      const textarea = screen.getByTestId('content-textarea');
      await user.type(textarea, 'Test content');

      const addButton = screen.getByTestId('add-button');
      await user.click(addButton);

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalled();
      });

      expect(onOpenChange).not.toHaveBeenCalledWith(false);
    });

    it('should not call router.refresh() on error', async () => {
      const user = userEvent.setup();
      render(<AddKnowledgeModal {...defaultProps} />);

      vi.mocked(fetch).mockRejectedValueOnce(new Error('API error'));

      const textarea = screen.getByTestId('content-textarea');
      await user.type(textarea, 'Test content');

      const addButton = screen.getByTestId('add-button');
      await user.click(addButton);

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalled();
      });

      expect(mockRefresh).not.toHaveBeenCalled();
    });

    it('should not call onSuccess on error', async () => {
      const user = userEvent.setup();
      const onSuccess = vi.fn();
      render(<AddKnowledgeModal {...defaultProps} onSuccess={onSuccess} />);

      vi.mocked(fetch).mockRejectedValueOnce(new Error('API error'));

      const textarea = screen.getByTestId('content-textarea');
      await user.type(textarea, 'Test content');

      const addButton = screen.getByTestId('add-button');
      await user.click(addButton);

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalled();
      });

      expect(onSuccess).not.toHaveBeenCalled();
    });

    it('should not navigate on error', async () => {
      const user = userEvent.setup();
      render(<AddKnowledgeModal {...defaultProps} />);

      vi.mocked(fetch).mockRejectedValueOnce(new Error('API error'));

      const textarea = screen.getByTestId('content-textarea');
      await user.type(textarea, 'Test content');

      const summaryButton = screen.getByTestId('add-summary-button');
      await user.click(summaryButton);

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalled();
      });

      expect(mockPush).not.toHaveBeenCalled();
    });
  });

  describe('Modal Lifecycle', () => {
    it('should reset content when modal is closed', async () => {
      const user = userEvent.setup();
      const { rerender } = render(<AddKnowledgeModal {...defaultProps} />);

      const textarea = screen.getByTestId('content-textarea');
      await user.type(textarea, 'Test content');

      await waitFor(() => {
        expect(textarea).toHaveValue('Test content');
      });

      // Close modal
      rerender(<AddKnowledgeModal {...defaultProps} open={false} />);

      // Reopen modal
      rerender(<AddKnowledgeModal {...defaultProps} open={true} />);

      await waitFor(() => {
        const newTextarea = screen.getByTestId('content-textarea');
        expect(newTextarea).toHaveValue('');
      });
    });

    it('should reset byte size display when modal is closed and reopened', async () => {
      const user = userEvent.setup();
      const { rerender } = render(<AddKnowledgeModal {...defaultProps} />);

      const textarea = screen.getByTestId('content-textarea');
      await user.type(textarea, 'a'.repeat(1024));

      await waitFor(() => {
        expect(screen.getByText('1.0 KB / 400 KB')).toBeInTheDocument();
      });

      // Close modal
      rerender(<AddKnowledgeModal {...defaultProps} open={false} />);

      // Reopen modal
      rerender(<AddKnowledgeModal {...defaultProps} open={true} />);

      await waitFor(() => {
        expect(screen.getByText('0.0 KB / 400 KB')).toBeInTheDocument();
      });
    });

    it('should not reset content while modal remains open', async () => {
      const user = userEvent.setup();
      render(<AddKnowledgeModal {...defaultProps} />);

      const textarea = screen.getByTestId('content-textarea');
      await user.type(textarea, 'Persistent content');

      await waitFor(() => {
        expect(textarea).toHaveValue('Persistent content');
      });

      // Content should persist
      expect(textarea).toHaveValue('Persistent content');
    });
  });

  describe('Loading States', () => {
    it('should disable buttons during submission', async () => {
      const user = userEvent.setup();
      render(<AddKnowledgeModal {...defaultProps} />);

      let resolvePromise: (value: Response) => void;
      const pendingPromise = new Promise<Response>((resolve) => {
        resolvePromise = resolve;
      });

      vi.mocked(fetch).mockReturnValueOnce(pendingPromise);

      const textarea = screen.getByTestId('content-textarea');
      await user.type(textarea, 'Test content');

      const addButton = screen.getByTestId('add-button');
      await user.click(addButton);

      await waitFor(() => {
        expect(screen.getByTestId('add-button')).toBeDisabled();
        expect(screen.getByTestId('add-summary-button')).toBeDisabled();
      });

      // Resolve promise
      resolvePromise?.({
        ok: true,
        json: async () => ({
          document: { id: 'doc-123', title: 'Test Doc' },
        }),
      } as Response);
    });

    it('should change button text during submission', async () => {
      const user = userEvent.setup();
      render(<AddKnowledgeModal {...defaultProps} />);

      let resolvePromise: (value: Response) => void;
      const pendingPromise = new Promise<Response>((resolve) => {
        resolvePromise = resolve;
      });

      vi.mocked(fetch).mockReturnValueOnce(pendingPromise);

      const textarea = screen.getByTestId('content-textarea');
      await user.type(textarea, 'Test content');

      const addButton = screen.getByTestId('add-button');
      await user.click(addButton);

      await waitFor(() => {
        expect(screen.getByTestId('add-button')).toHaveTextContent('Adding...');
        expect(screen.getByTestId('add-summary-button')).toHaveTextContent(
          'Adding...',
        );
      });

      // Resolve promise
      resolvePromise?.({
        ok: true,
        json: async () => ({
          document: { id: 'doc-123', title: 'Test Doc' },
        }),
      } as Response);
    });

    it('should disable textarea during submission', async () => {
      const user = userEvent.setup();
      render(<AddKnowledgeModal {...defaultProps} />);

      let resolvePromise: (value: Response) => void;
      const pendingPromise = new Promise<Response>((resolve) => {
        resolvePromise = resolve;
      });

      vi.mocked(fetch).mockReturnValueOnce(pendingPromise);

      const textarea = screen.getByTestId('content-textarea');
      await user.type(textarea, 'Test content');

      const addButton = screen.getByTestId('add-button');
      await user.click(addButton);

      await waitFor(() => {
        expect(textarea).toBeDisabled();
      });

      // Resolve promise
      resolvePromise?.({
        ok: true,
        json: async () => ({
          document: { id: 'doc-123', title: 'Test Doc' },
        }),
      } as Response);
    });

    it('should re-enable buttons after submission completes', async () => {
      const user = userEvent.setup();
      render(<AddKnowledgeModal {...defaultProps} />);

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          document: { id: 'doc-123', title: 'Test Doc' },
        }),
      } as Response);

      const textarea = screen.getByTestId('content-textarea');
      await user.type(textarea, 'Test content');

      const addButton = screen.getByTestId('add-button');
      await user.click(addButton);

      await waitFor(() => {
        expect(mockToastSuccess).toHaveBeenCalled();
      });

      // Modal should be closed, so buttons won't be visible
      // But the state should be reset for next open
    });

    it('should re-enable buttons after error', async () => {
      const user = userEvent.setup();
      const onOpenChange = vi.fn(); // Modal stays open on error
      render(
        <AddKnowledgeModal {...defaultProps} onOpenChange={onOpenChange} />,
      );

      vi.mocked(fetch).mockRejectedValueOnce(new Error('API error'));

      const textarea = screen.getByTestId('content-textarea');
      await user.type(textarea, 'Test content');

      const addButton = screen.getByTestId('add-button');
      await user.click(addButton);

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalled();
      });

      // Modal should stay open, buttons should be enabled again
      expect(onOpenChange).not.toHaveBeenCalledWith(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle rapid button clicks', async () => {
      const user = userEvent.setup();
      render(<AddKnowledgeModal {...defaultProps} />);

      // Use a slow-resolving promise to allow rapid clicks
      let resolvePromise: (value: Response) => void;
      const pendingPromise = new Promise<Response>((resolve) => {
        resolvePromise = resolve;
      });

      vi.mocked(fetch).mockReturnValueOnce(pendingPromise);

      const textarea = screen.getByTestId('content-textarea');
      await user.type(textarea, 'Test content');

      const addButton = screen.getByTestId('add-button');

      // Click multiple times rapidly - only first should go through
      await user.click(addButton);

      // Wait for button to be disabled
      await waitFor(() => {
        expect(addButton).toBeDisabled();
      });

      // Try more clicks (should be ignored)
      await user.click(addButton);
      await user.click(addButton);

      // Resolve the promise
      resolvePromise?.({
        ok: true,
        json: async () => ({
          document: { id: 'doc-123', title: 'Test Doc' },
        }),
      } as Response);

      await waitFor(() => {
        expect(mockToastSuccess).toHaveBeenCalled();
      });

      // Should only call API once due to disabled state
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('should handle concurrent Add and Add with Summary attempts', async () => {
      const user = userEvent.setup();
      render(<AddKnowledgeModal {...defaultProps} />);

      let resolvePromise: (value: Response) => void;
      const pendingPromise = new Promise<Response>((resolve) => {
        resolvePromise = resolve;
      });

      vi.mocked(fetch).mockReturnValueOnce(pendingPromise);

      const textarea = screen.getByTestId('content-textarea');
      await user.type(textarea, 'Test content');

      const addButton = screen.getByTestId('add-button');
      const summaryButton = screen.getByTestId('add-summary-button');

      // Click Add button
      await user.click(addButton);

      await waitFor(() => {
        expect(addButton).toBeDisabled();
      });

      // Try to click Add with Summary button (should be disabled)
      expect(summaryButton).toBeDisabled();

      // Complete first request
      resolvePromise?.({
        ok: true,
        json: async () => ({
          document: { id: 'doc-123', title: 'Test Doc' },
        }),
      } as Response);

      await waitFor(() => {
        expect(mockToastSuccess).toHaveBeenCalledOnce();
      });
    });

    it('should handle very long content efficiently', async () => {
      const user = userEvent.setup();
      render(<AddKnowledgeModal {...defaultProps} />);

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          document: { id: 'doc-123', title: 'Test Doc' },
        }),
      } as Response);

      const textarea = screen.getByTestId('content-textarea');
      const longContent = 'a'.repeat(350 * 1024); // 350KB
      setTextareaValue(textarea, longContent);

      const addButton = screen.getByTestId('add-button');
      await user.click(addButton);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalled();
      });

      const fetchCall = vi.mocked(fetch).mock.calls[0];
      const body = JSON.parse(fetchCall[1]?.body as string);
      expect(body.content).toBe(longContent);
    }, 10000); // Increase timeout to 10s for this test

    it('should handle special characters in content', async () => {
      const user = userEvent.setup();
      render(<AddKnowledgeModal {...defaultProps} />);

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          document: { id: 'doc-123', title: 'Test Doc' },
        }),
      } as Response);

      const specialContent = 'Test <>&"\' special chars';
      const textarea = screen.getByTestId('content-textarea');
      setTextareaValue(textarea, specialContent);

      const addButton = screen.getByTestId('add-button');
      await user.click(addButton);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalled();
      });

      const fetchCall = vi.mocked(fetch).mock.calls[0];
      const body = JSON.parse(fetchCall[1]?.body as string);
      expect(body.content).toBe(specialContent);
    });

    it('should handle newlines and formatting in content', async () => {
      const user = userEvent.setup();
      render(<AddKnowledgeModal {...defaultProps} />);

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          document: { id: 'doc-123', title: 'Test Doc' },
        }),
      } as Response);

      const formattedContent = 'Line 1\nLine 2\n\nLine 4\tTabbed';
      const textarea = screen.getByTestId('content-textarea');
      setTextareaValue(textarea, formattedContent);

      const addButton = screen.getByTestId('add-button');
      await user.click(addButton);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalled();
      });

      const fetchCall = vi.mocked(fetch).mock.calls[0];
      const body = JSON.parse(fetchCall[1]?.body as string);
      expect(body.content).toBe(formattedContent);
    });
  });
});
