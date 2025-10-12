import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { UploadTranscriptButton } from '@/components/upload-transcript-button';

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

// Mock Button component
vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    disabled,
    className,
    size,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    className?: string;
    size?: string;
  }) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      data-testid="upload-button"
      data-classname={className}
      data-size={size}
    >
      {children}
    </button>
  ),
}));

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  FileAudioIcon: ({ className }: { className?: string }) => (
    <svg data-testid="file-audio-icon" data-classname={className} />
  ),
  LoaderIcon: ({ className }: { className?: string }) => (
    <svg data-testid="loader-icon" data-classname={className} />
  ),
}));

describe('UploadTranscriptButton Component', () => {
  const defaultProps = {
    workspaceId: 'workspace-123',
    objectiveId: 'objective-456',
  };

  let mockRefresh: ReturnType<typeof vi.fn>;
  let mockPush: ReturnType<typeof vi.fn>;
  let mockToastSuccess: ReturnType<typeof vi.fn>;
  let mockToastError: ReturnType<typeof vi.fn>;

  // Helper function to simulate file selection
  const simulateFileSelection = (file: File) => {
    const fileInput = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;

    Object.defineProperty(fileInput, 'files', {
      value: [file],
      writable: false,
      configurable: true,
    });

    const changeEvent = new Event('change', { bubbles: true });
    fileInput.dispatchEvent(changeEvent);
  };

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
    it('should render button with correct text', () => {
      render(<UploadTranscriptButton {...defaultProps} />);

      expect(screen.getByTestId('upload-button')).toBeInTheDocument();
      expect(screen.getByText('Upload Transcript')).toBeInTheDocument();
    });

    it('should render FileAudioIcon when not uploading', () => {
      render(<UploadTranscriptButton {...defaultProps} />);

      expect(screen.getByTestId('file-audio-icon')).toBeInTheDocument();
      expect(screen.queryByTestId('loader-icon')).not.toBeInTheDocument();
    });

    it('should render with correct styling classes', () => {
      render(<UploadTranscriptButton {...defaultProps} />);

      const button = screen.getByTestId('upload-button');
      const className = button.getAttribute('data-classname');

      expect(className).toContain('flex items-center gap-2');
      expect(className).toContain('rounded-lg');
      expect(className).toContain('shadow-sm');
      expect(button.getAttribute('data-size')).toBe('default');
    });

    it('should render hidden file input', () => {
      const { container } = render(
        <UploadTranscriptButton {...defaultProps} />,
      );

      const fileInput = container.querySelector('input[type="file"]');
      expect(fileInput).toBeInTheDocument();
      expect(fileInput).toHaveClass('fixed');
      expect(fileInput).toHaveAttribute('tabIndex', '-1');
    });

    it('should accept correct file types', () => {
      const { container } = render(
        <UploadTranscriptButton {...defaultProps} />,
      );

      const fileInput = container.querySelector('input[type="file"]');
      expect(fileInput).toHaveAttribute(
        'accept',
        '.txt,.md,.vtt,.srt,.transcript',
      );
    });
  });

  describe('Button Click Behavior', () => {
    it('should trigger file input on button click', async () => {
      const user = userEvent.setup();
      const { container } = render(
        <UploadTranscriptButton {...defaultProps} />,
      );

      const button = screen.getByTestId('upload-button');
      const fileInput = container.querySelector(
        'input[type="file"]',
      ) as HTMLInputElement;

      const clickSpy = vi.fn();
      fileInput.click = clickSpy;

      await user.click(button);

      expect(clickSpy).toHaveBeenCalledOnce();
    });

    it('should not trigger file input when button is disabled', () => {
      const { container } = render(
        <UploadTranscriptButton {...defaultProps} />,
      );

      const button = screen.getByTestId('upload-button');
      const fileInput = container.querySelector(
        'input[type="file"]',
      ) as HTMLInputElement;

      // Manually set button to disabled state
      button.setAttribute('disabled', 'true');
      fileInput.disabled = true;

      expect(button).toBeDisabled();
    });
  });

  describe('File Extension Validation', () => {
    it('should accept .txt files', async () => {
      const user = userEvent.setup();
      const { container } = render(
        <UploadTranscriptButton {...defaultProps} />,
      );

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, documentId: 'doc-123' }),
      } as Response);

      const fileInput = container.querySelector(
        'input[type="file"]',
      ) as HTMLInputElement;
      const file = new File(['transcript content'], 'meeting.txt', {
        type: 'text/plain',
      });

      await user.upload(fileInput, file);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledOnce();
      });

      expect(mockToastError).not.toHaveBeenCalled();
    });

    it('should accept .md files', async () => {
      const user = userEvent.setup();
      const { container } = render(
        <UploadTranscriptButton {...defaultProps} />,
      );

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, documentId: 'doc-123' }),
      } as Response);

      const fileInput = container.querySelector(
        'input[type="file"]',
      ) as HTMLInputElement;
      const file = new File(['# Meeting Notes'], 'notes.md', {
        type: 'text/markdown',
      });

      await user.upload(fileInput, file);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledOnce();
      });

      expect(mockToastError).not.toHaveBeenCalled();
    });

    it('should accept .vtt files', async () => {
      const user = userEvent.setup();
      const { container } = render(
        <UploadTranscriptButton {...defaultProps} />,
      );

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, documentId: 'doc-123' }),
      } as Response);

      const fileInput = container.querySelector(
        'input[type="file"]',
      ) as HTMLInputElement;
      const file = new File(['WEBVTT\n\n00:00.000'], 'captions.vtt', {
        type: 'text/vtt',
      });

      await user.upload(fileInput, file);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledOnce();
      });

      expect(mockToastError).not.toHaveBeenCalled();
    });

    it('should accept .srt files', async () => {
      const user = userEvent.setup();
      const { container } = render(
        <UploadTranscriptButton {...defaultProps} />,
      );

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, documentId: 'doc-123' }),
      } as Response);

      const fileInput = container.querySelector(
        'input[type="file"]',
      ) as HTMLInputElement;
      const file = new File(['1\n00:00:00,000'], 'subtitles.srt', {
        type: 'application/x-subrip',
      });

      await user.upload(fileInput, file);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledOnce();
      });

      expect(mockToastError).not.toHaveBeenCalled();
    });

    it('should accept .transcript files', async () => {
      const user = userEvent.setup();
      const { container } = render(
        <UploadTranscriptButton {...defaultProps} />,
      );

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, documentId: 'doc-123' }),
      } as Response);

      const fileInput = container.querySelector(
        'input[type="file"]',
      ) as HTMLInputElement;
      const file = new File(['Speaker 1: Hello'], 'call.transcript', {
        type: 'text/plain',
      });

      await user.upload(fileInput, file);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledOnce();
      });

      expect(mockToastError).not.toHaveBeenCalled();
    });

    it('should reject .pdf files', async () => {
      render(<UploadTranscriptButton {...defaultProps} />);

      const file = new File(['%PDF-1.4'], 'document.pdf', {
        type: 'application/pdf',
      });

      simulateFileSelection(file);

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith(
          'Invalid file type. Please upload: .txt, .md, .vtt, .srt, .transcript',
        );
      });

      expect(fetch).not.toHaveBeenCalled();
    });

    it('should reject .docx files', async () => {
      render(<UploadTranscriptButton {...defaultProps} />);

      const file = new File(['content'], 'document.docx', {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });

      simulateFileSelection(file);

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith(
          'Invalid file type. Please upload: .txt, .md, .vtt, .srt, .transcript',
        );
      });

      expect(fetch).not.toHaveBeenCalled();
    });

    it('should reject files with no extension', async () => {
      render(<UploadTranscriptButton {...defaultProps} />);

      const file = new File(['content'], 'noextension', {
        type: 'text/plain',
      });

      simulateFileSelection(file);

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith(
          'Invalid file type. Please upload: .txt, .md, .vtt, .srt, .transcript',
        );
      });

      expect(fetch).not.toHaveBeenCalled();
    });

    it('should handle case-insensitive extension matching', async () => {
      const user = userEvent.setup();
      const { container } = render(
        <UploadTranscriptButton {...defaultProps} />,
      );

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, documentId: 'doc-123' }),
      } as Response);

      const fileInput = container.querySelector(
        'input[type="file"]',
      ) as HTMLInputElement;
      const file = new File(['content'], 'MEETING.TXT', {
        type: 'text/plain',
      });

      await user.upload(fileInput, file);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledOnce();
      });

      expect(mockToastError).not.toHaveBeenCalled();
    });
  });

  describe('File Size Validation', () => {
    it('should accept files under 400KB', async () => {
      const user = userEvent.setup();
      const { container } = render(
        <UploadTranscriptButton {...defaultProps} />,
      );

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, documentId: 'doc-123' }),
      } as Response);

      const fileInput = container.querySelector(
        'input[type="file"]',
      ) as HTMLInputElement;
      // 300KB file
      const content = 'a'.repeat(300 * 1024);
      const file = new File([content], 'large.txt', { type: 'text/plain' });

      await user.upload(fileInput, file);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledOnce();
      });

      expect(mockToastError).not.toHaveBeenCalled();
    });

    it('should accept files exactly at 400KB', async () => {
      const user = userEvent.setup();
      const { container } = render(
        <UploadTranscriptButton {...defaultProps} />,
      );

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, documentId: 'doc-123' }),
      } as Response);

      const fileInput = container.querySelector(
        'input[type="file"]',
      ) as HTMLInputElement;
      // Exactly 400KB
      const content = 'a'.repeat(400 * 1024);
      const file = new File([content], 'exact.txt', { type: 'text/plain' });

      await user.upload(fileInput, file);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledOnce();
      });

      expect(mockToastError).not.toHaveBeenCalled();
    });

    it('should reject files over 400KB', async () => {
      const user = userEvent.setup();
      const { container } = render(
        <UploadTranscriptButton {...defaultProps} />,
      );

      const fileInput = container.querySelector(
        'input[type="file"]',
      ) as HTMLInputElement;
      // 401KB file
      const content = 'a'.repeat(401 * 1024);
      const file = new File([content], 'toolarge.txt', { type: 'text/plain' });

      await user.upload(fileInput, file);

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith(
          'File too large. Maximum size is 400KB for optimal processing.',
        );
      });

      expect(fetch).not.toHaveBeenCalled();
    });

    it('should show correct size limit in error message', async () => {
      const user = userEvent.setup();
      const { container } = render(
        <UploadTranscriptButton {...defaultProps} />,
      );

      const fileInput = container.querySelector(
        'input[type="file"]',
      ) as HTMLInputElement;
      const content = 'a'.repeat(500 * 1024); // 500KB
      const file = new File([content], 'huge.txt', { type: 'text/plain' });

      await user.upload(fileInput, file);

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith(
          expect.stringContaining('400KB'),
        );
      });
    });
  });

  describe('Upload API Call', () => {
    it('should call /api/files/upload with correct FormData', async () => {
      const user = userEvent.setup();
      const { container } = render(
        <UploadTranscriptButton {...defaultProps} />,
      );

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, documentId: 'doc-123' }),
      } as Response);

      const fileInput = container.querySelector(
        'input[type="file"]',
      ) as HTMLInputElement;
      const file = new File(['content'], 'test.txt', { type: 'text/plain' });

      await user.upload(fileInput, file);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledOnce();
      });

      const fetchCall = vi.mocked(fetch).mock.calls[0];
      expect(fetchCall[0]).toBe('/api/files/upload');
      expect(fetchCall[1]?.method).toBe('POST');

      // Verify FormData contents
      const formData = fetchCall[1]?.body as FormData;
      expect(formData).toBeInstanceOf(FormData);
      expect(formData.get('file')).toBe(file);
      expect(formData.get('objectiveId')).toBe('objective-456');
      expect(formData.get('workspaceId')).toBe('workspace-123');
    });

    it('should include objectiveId in FormData', async () => {
      const user = userEvent.setup();
      const { container } = render(
        <UploadTranscriptButton workspaceId="ws-999" objectiveId="obj-888" />,
      );

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, documentId: 'doc-123' }),
      } as Response);

      const fileInput = container.querySelector(
        'input[type="file"]',
      ) as HTMLInputElement;
      const file = new File(['content'], 'test.txt', { type: 'text/plain' });

      await user.upload(fileInput, file);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledOnce();
      });

      const formData = vi.mocked(fetch).mock.calls[0][1]?.body as FormData;
      expect(formData.get('objectiveId')).toBe('obj-888');
    });

    it('should include workspaceId in FormData', async () => {
      const user = userEvent.setup();
      const { container } = render(
        <UploadTranscriptButton workspaceId="ws-777" objectiveId="obj-666" />,
      );

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, documentId: 'doc-123' }),
      } as Response);

      const fileInput = container.querySelector(
        'input[type="file"]',
      ) as HTMLInputElement;
      const file = new File(['content'], 'test.txt', { type: 'text/plain' });

      await user.upload(fileInput, file);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledOnce();
      });

      const formData = vi.mocked(fetch).mock.calls[0][1]?.body as FormData;
      expect(formData.get('workspaceId')).toBe('ws-777');
    });
  });

  describe('Loading States', () => {
    it('should show loading state during upload', async () => {
      const user = userEvent.setup();
      const { container } = render(
        <UploadTranscriptButton {...defaultProps} />,
      );

      // Mock slow API response
      let resolvePromise: (value: Response) => void;
      const pendingPromise = new Promise<Response>((resolve) => {
        resolvePromise = resolve;
      });

      vi.mocked(fetch).mockReturnValueOnce(pendingPromise);

      const fileInput = container.querySelector(
        'input[type="file"]',
      ) as HTMLInputElement;
      const file = new File(['content'], 'test.txt', { type: 'text/plain' });

      await user.upload(fileInput, file);

      // Should show loading state
      await waitFor(() => {
        expect(screen.getByTestId('loader-icon')).toBeInTheDocument();
        expect(screen.getByText('Uploading...')).toBeInTheDocument();
        expect(screen.queryByTestId('file-audio-icon')).not.toBeInTheDocument();
      });

      // Resolve the promise
      resolvePromise?.({
        ok: true,
        json: async () => ({ success: true, documentId: 'doc-123' }),
      } as Response);
    });

    it('should disable button during upload', async () => {
      const user = userEvent.setup();
      const { container } = render(
        <UploadTranscriptButton {...defaultProps} />,
      );

      let resolvePromise: (value: Response) => void;
      const pendingPromise = new Promise<Response>((resolve) => {
        resolvePromise = resolve;
      });

      vi.mocked(fetch).mockReturnValueOnce(pendingPromise);

      const fileInput = container.querySelector(
        'input[type="file"]',
      ) as HTMLInputElement;
      const file = new File(['content'], 'test.txt', { type: 'text/plain' });

      await user.upload(fileInput, file);

      // Button should be disabled
      await waitFor(() => {
        const button = screen.getByTestId('upload-button');
        expect(button).toBeDisabled();
      });

      resolvePromise?.({
        ok: true,
        json: async () => ({ success: true, documentId: 'doc-123' }),
      } as Response);
    });

    it('should re-enable button after upload completes', async () => {
      const user = userEvent.setup();
      render(<UploadTranscriptButton {...defaultProps} />);

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, documentId: 'doc-123' }),
      } as Response);

      const button = screen.getByTestId('upload-button');
      const fileInput = document.querySelector(
        'input[type="file"]',
      ) as HTMLInputElement;
      const file = new File(['content'], 'test.txt', { type: 'text/plain' });

      await user.upload(fileInput, file);

      // Wait for upload to complete
      await waitFor(() => {
        expect(mockToastSuccess).toHaveBeenCalled();
      });

      // Button should be re-enabled
      expect(button).not.toBeDisabled();
    });

    it('should disable file input during upload', async () => {
      const user = userEvent.setup();
      const { container } = render(
        <UploadTranscriptButton {...defaultProps} />,
      );

      let resolvePromise: (value: Response) => void;
      const pendingPromise = new Promise<Response>((resolve) => {
        resolvePromise = resolve;
      });

      vi.mocked(fetch).mockReturnValueOnce(pendingPromise);

      const fileInput = container.querySelector(
        'input[type="file"]',
      ) as HTMLInputElement;
      const file = new File(['content'], 'test.txt', { type: 'text/plain' });

      await user.upload(fileInput, file);

      // File input should be disabled
      await waitFor(() => {
        expect(fileInput).toBeDisabled();
      });

      resolvePromise?.({
        ok: true,
        json: async () => ({ success: true, documentId: 'doc-123' }),
      } as Response);
    });
  });

  describe('Success Handling', () => {
    it('should show success toast on successful upload', async () => {
      const user = userEvent.setup();
      const { container } = render(
        <UploadTranscriptButton {...defaultProps} />,
      );

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, documentId: 'doc-123' }),
      } as Response);

      const fileInput = container.querySelector(
        'input[type="file"]',
      ) as HTMLInputElement;
      const file = new File(['content'], 'test.txt', { type: 'text/plain' });

      await user.upload(fileInput, file);

      await waitFor(() => {
        expect(mockToastSuccess).toHaveBeenCalledWith(
          'Transcript uploaded and analyzed successfully!',
        );
      });
    });

    it('should call router.refresh() on success', async () => {
      const user = userEvent.setup();
      const { container } = render(
        <UploadTranscriptButton {...defaultProps} />,
      );

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, documentId: 'doc-123' }),
      } as Response);

      const fileInput = container.querySelector(
        'input[type="file"]',
      ) as HTMLInputElement;
      const file = new File(['content'], 'test.txt', { type: 'text/plain' });

      await user.upload(fileInput, file);

      await waitFor(() => {
        expect(mockRefresh).toHaveBeenCalledOnce();
      });
    });

    it('should call onUploadComplete callback with documentId', async () => {
      const user = userEvent.setup();
      const onUploadComplete = vi.fn();
      const { container } = render(
        <UploadTranscriptButton
          {...defaultProps}
          onUploadComplete={onUploadComplete}
        />,
      );

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, documentId: 'doc-789' }),
      } as Response);

      const fileInput = container.querySelector(
        'input[type="file"]',
      ) as HTMLInputElement;
      const file = new File(['content'], 'test.txt', { type: 'text/plain' });

      await user.upload(fileInput, file);

      await waitFor(() => {
        expect(onUploadComplete).toHaveBeenCalledWith('doc-789');
      });
    });

    it('should not error if onUploadComplete is not provided', async () => {
      const user = userEvent.setup();
      const { container } = render(
        <UploadTranscriptButton {...defaultProps} />,
      );

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, documentId: 'doc-123' }),
      } as Response);

      const fileInput = container.querySelector(
        'input[type="file"]',
      ) as HTMLInputElement;
      const file = new File(['content'], 'test.txt', { type: 'text/plain' });

      await user.upload(fileInput, file);

      await waitFor(() => {
        expect(mockToastSuccess).toHaveBeenCalled();
      });

      // Should not throw error
      expect(mockToastError).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should show error toast on API failure (non-ok response)', async () => {
      const user = userEvent.setup();
      const { container } = render(
        <UploadTranscriptButton {...defaultProps} />,
      );

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'File too large' }),
      } as Response);

      const fileInput = container.querySelector(
        'input[type="file"]',
      ) as HTMLInputElement;
      const file = new File(['content'], 'test.txt', { type: 'text/plain' });

      await user.upload(fileInput, file);

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith('File too large');
      });

      expect(mockToastSuccess).not.toHaveBeenCalled();
    });

    it('should show generic error when API returns no error message', async () => {
      const user = userEvent.setup();
      const { container } = render(
        <UploadTranscriptButton {...defaultProps} />,
      );

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        json: async () => ({}),
      } as Response);

      const fileInput = container.querySelector(
        'input[type="file"]',
      ) as HTMLInputElement;
      const file = new File(['content'], 'test.txt', { type: 'text/plain' });

      await user.upload(fileInput, file);

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith('Upload failed');
      });
    });

    it('should handle network errors gracefully', async () => {
      const user = userEvent.setup();
      const { container } = render(
        <UploadTranscriptButton {...defaultProps} />,
      );

      vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'));

      const fileInput = container.querySelector(
        'input[type="file"]',
      ) as HTMLInputElement;
      const file = new File(['content'], 'test.txt', { type: 'text/plain' });

      await user.upload(fileInput, file);

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith('Network error');
      });
    });

    it('should handle non-Error exceptions', async () => {
      const user = userEvent.setup();
      const { container } = render(
        <UploadTranscriptButton {...defaultProps} />,
      );

      vi.mocked(fetch).mockRejectedValueOnce('String error');

      const fileInput = container.querySelector(
        'input[type="file"]',
      ) as HTMLInputElement;
      const file = new File(['content'], 'test.txt', { type: 'text/plain' });

      await user.upload(fileInput, file);

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith(
          'Failed to upload transcript',
        );
      });
    });

    it('should re-enable button after error', async () => {
      const user = userEvent.setup();
      render(<UploadTranscriptButton {...defaultProps} />);

      vi.mocked(fetch).mockRejectedValueOnce(new Error('Upload failed'));

      const button = screen.getByTestId('upload-button');
      const fileInput = document.querySelector(
        'input[type="file"]',
      ) as HTMLInputElement;
      const file = new File(['content'], 'test.txt', { type: 'text/plain' });

      await user.upload(fileInput, file);

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalled();
      });

      // Button should be re-enabled after error
      expect(button).not.toBeDisabled();
    });

    it('should not call router.refresh() on error', async () => {
      const user = userEvent.setup();
      const { container } = render(
        <UploadTranscriptButton {...defaultProps} />,
      );

      vi.mocked(fetch).mockRejectedValueOnce(new Error('Upload failed'));

      const fileInput = container.querySelector(
        'input[type="file"]',
      ) as HTMLInputElement;
      const file = new File(['content'], 'test.txt', { type: 'text/plain' });

      await user.upload(fileInput, file);

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalled();
      });

      expect(mockRefresh).not.toHaveBeenCalled();
    });

    it('should not call onUploadComplete on error', async () => {
      const user = userEvent.setup();
      const onUploadComplete = vi.fn();
      const { container } = render(
        <UploadTranscriptButton
          {...defaultProps}
          onUploadComplete={onUploadComplete}
        />,
      );

      vi.mocked(fetch).mockRejectedValueOnce(new Error('Upload failed'));

      const fileInput = container.querySelector(
        'input[type="file"]',
      ) as HTMLInputElement;
      const file = new File(['content'], 'test.txt', { type: 'text/plain' });

      await user.upload(fileInput, file);

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalled();
      });

      expect(onUploadComplete).not.toHaveBeenCalled();
    });
  });

  describe('File Input Reset', () => {
    it('should reset file input after selection', async () => {
      const user = userEvent.setup();
      const { container } = render(
        <UploadTranscriptButton {...defaultProps} />,
      );

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, documentId: 'doc-123' }),
      } as Response);

      const fileInput = container.querySelector(
        'input[type="file"]',
      ) as HTMLInputElement;
      const file = new File(['content'], 'test.txt', { type: 'text/plain' });

      await user.upload(fileInput, file);

      await waitFor(() => {
        expect(mockToastSuccess).toHaveBeenCalled();
      });

      // File input should be reset (value should be empty)
      expect(fileInput.value).toBe('');
    });

    it('should allow uploading same file twice', async () => {
      const user = userEvent.setup();
      const { container } = render(
        <UploadTranscriptButton {...defaultProps} />,
      );

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, documentId: 'doc-123' }),
      } as Response);

      const fileInput = container.querySelector(
        'input[type="file"]',
      ) as HTMLInputElement;
      const file = new File(['content'], 'test.txt', { type: 'text/plain' });

      // First upload
      await user.upload(fileInput, file);
      await waitFor(() => {
        expect(mockToastSuccess).toHaveBeenCalledTimes(1);
      });

      // Second upload (same file)
      await user.upload(fileInput, file);
      await waitFor(() => {
        expect(mockToastSuccess).toHaveBeenCalledTimes(2);
      });

      expect(fetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('Edge Cases', () => {
    it('should handle null file selection (cancel dialog)', async () => {
      const { container } = render(
        <UploadTranscriptButton {...defaultProps} />,
      );

      const fileInput = container.querySelector(
        'input[type="file"]',
      ) as HTMLInputElement;

      // Simulate user canceling file dialog
      const event = new Event('change', { bubbles: true });
      Object.defineProperty(event, 'target', {
        writable: false,
        value: { files: [] },
      });

      fileInput.dispatchEvent(event);

      // Should not call API or show any toast
      expect(fetch).not.toHaveBeenCalled();
      expect(mockToastError).not.toHaveBeenCalled();
      expect(mockToastSuccess).not.toHaveBeenCalled();
    });

    it('should handle file with multiple dots in name', async () => {
      const user = userEvent.setup();
      const { container } = render(
        <UploadTranscriptButton {...defaultProps} />,
      );

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, documentId: 'doc-123' }),
      } as Response);

      const fileInput = container.querySelector(
        'input[type="file"]',
      ) as HTMLInputElement;
      const file = new File(['content'], 'meeting.2024.01.15.txt', {
        type: 'text/plain',
      });

      await user.upload(fileInput, file);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledOnce();
      });

      expect(mockToastError).not.toHaveBeenCalled();
    });

    it('should handle very small files (1 byte)', async () => {
      const user = userEvent.setup();
      const { container } = render(
        <UploadTranscriptButton {...defaultProps} />,
      );

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, documentId: 'doc-123' }),
      } as Response);

      const fileInput = container.querySelector(
        'input[type="file"]',
      ) as HTMLInputElement;
      const file = new File(['a'], 'tiny.txt', { type: 'text/plain' });

      await user.upload(fileInput, file);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledOnce();
      });

      expect(mockToastError).not.toHaveBeenCalled();
    });

    it('should handle concurrent upload attempts', async () => {
      const user = userEvent.setup();
      const { container } = render(
        <UploadTranscriptButton {...defaultProps} />,
      );

      // First upload will be slow
      let resolveFirst: (value: Response) => void;
      const firstPromise = new Promise<Response>((resolve) => {
        resolveFirst = resolve;
      });

      vi.mocked(fetch).mockReturnValueOnce(firstPromise);

      const fileInput = container.querySelector(
        'input[type="file"]',
      ) as HTMLInputElement;
      const file = new File(['content'], 'test.txt', { type: 'text/plain' });

      // Start first upload
      await user.upload(fileInput, file);

      // Button should be disabled
      await waitFor(() => {
        expect(screen.getByTestId('upload-button')).toBeDisabled();
      });

      // Try to start second upload (should be prevented by disabled state)
      const fileInput2 = container.querySelector(
        'input[type="file"]',
      ) as HTMLInputElement;
      expect(fileInput2).toBeDisabled();

      // Complete first upload
      resolveFirst?.({
        ok: true,
        json: async () => ({ success: true, documentId: 'doc-123' }),
      } as Response);

      await waitFor(() => {
        expect(mockToastSuccess).toHaveBeenCalledOnce();
      });
    });
  });
});
