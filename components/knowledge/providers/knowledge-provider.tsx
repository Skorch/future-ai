'use client';

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';

interface KnowledgeCreationContext {
  // State
  content: string;
  byteSize: number;
  isSubmitting: boolean;
  submittingAction: 'add' | 'summarize' | null;
  isReadingFile: boolean;
  isValid: boolean;
  maxSize: number;

  // Actions
  setContent: (content: string) => void;
  createDocument: (summarize: boolean) => Promise<void>;
  uploadFile: (file: File) => Promise<void>;
}

const KnowledgeContext = createContext<KnowledgeCreationContext | null>(null);

interface KnowledgeProviderProps {
  children: React.ReactNode;
  workspaceId: string;
  objectiveId: string;
  open: boolean; // NEW: track modal open state for content clearing
  onClose: (didCreate: boolean) => void;
  onNavigate: (url: string) => void;
}

const MAX_SIZE = 400 * 1024; // 400KB in bytes

export function KnowledgeProvider({
  children,
  workspaceId,
  objectiveId,
  open, // NEW
  onClose,
  onNavigate,
}: KnowledgeProviderProps) {
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittingAction, setSubmittingAction] = useState<
    'add' | 'summarize' | null
  >(null);
  const [isReadingFile, setIsReadingFile] = useState(false);
  const isSubmittingRef = useRef(false);

  // Clear content when modal closes
  useEffect(() => {
    if (!open) {
      setContent('');
    }
  }, [open]);

  // Calculate byte size using UTF-8 encoding
  const byteSize = useMemo(
    () => new TextEncoder().encode(content).length,
    [content],
  );

  const isValid = content.trim().length > 0 && byteSize <= MAX_SIZE;

  const uploadFile = async (file: File) => {
    // Validate extension
    const validExtensions = ['.txt', '.md', '.vtt', '.srt', '.transcript'];
    const fileExt = `.${file.name.split('.').pop()?.toLowerCase()}`;
    if (!validExtensions.includes(fileExt)) {
      toast.error(`Invalid file type. Allowed: ${validExtensions.join(', ')}`);
      return;
    }

    // Validate size (400KB)
    if (file.size > MAX_SIZE) {
      toast.error('File size must be less than 400KB');
      return;
    }

    // Read and populate textarea
    setIsReadingFile(true);
    try {
      const fileContent = await file.text();
      setContent(fileContent);
      toast.success(`Loaded ${file.name}`);
    } catch (error) {
      logger.error('File read error:', error);
      toast.error(
        error instanceof Error
          ? `Failed to read file: ${error.message}`
          : 'Failed to read file content',
      );
    } finally {
      setIsReadingFile(false);
    }
  };

  const createDocument = async (summarize: boolean) => {
    if (!isValid || isSubmittingRef.current) return;

    isSubmittingRef.current = true;
    setIsSubmitting(true);
    setSubmittingAction(summarize ? 'summarize' : 'add');

    try {
      const response = await fetch(`/api/workspace/${workspaceId}/knowledge`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(summarize && { 'X-Create-Summary': 'true' }),
        },
        body: JSON.stringify({
          content,
          category: 'raw',
          objectiveId,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create knowledge document');
      }

      const data = await response.json();

      // UX Polish: Contextual success message
      toast.success(
        summarize
          ? 'Knowledge document created! Opening summary chat...'
          : 'Knowledge document created successfully!',
      );

      // Close dialog first, passing didCreateDocument=true so parent can refresh
      onClose(true);

      // Wait for dialog animation to complete (150ms)
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Navigate to chat if summary requested
      if (summarize && data.shouldCreateSummary) {
        // Simple instruction for AI to load and summarize the document
        const summaryPrompt = `Please load and create a summary of the document I just created titled "${data.document.title}".  Use the appropriate Playbook.`;

        const queryParam = encodeURIComponent(summaryPrompt);
        const url = `/workspace/${workspaceId}/chat/new?objectiveId=${objectiveId}&query=${queryParam}&autoSubmit=true`;

        // Let parent handle navigation (which will call router.refresh() ONCE)
        onNavigate(url);
      }
      // Parent will call router.refresh() for non-summary case via onClose(true)
    } catch (error) {
      // Distinguish network errors from API errors
      if (error instanceof TypeError && error.message.includes('fetch')) {
        toast.error(
          'Network error. Please check your connection and try again.',
        );
      } else {
        toast.error(
          error instanceof Error
            ? error.message
            : 'Failed to create knowledge document',
        );
      }
      logger.error('Knowledge document creation error:', error);
    } finally {
      setIsSubmitting(false);
      setSubmittingAction(null);
      isSubmittingRef.current = false;
    }
  };

  const value: KnowledgeCreationContext = {
    content,
    byteSize,
    isSubmitting,
    submittingAction,
    isReadingFile,
    isValid,
    maxSize: MAX_SIZE,
    setContent,
    createDocument,
    uploadFile,
  };

  return (
    <KnowledgeContext.Provider value={value}>
      {children}
    </KnowledgeContext.Provider>
  );
}

export function useKnowledge() {
  const context = useContext(KnowledgeContext);
  if (!context) {
    throw new Error('useKnowledge must be used within a KnowledgeProvider');
  }
  return context;
}

/*
 * FUTURE EXTENSIONS:
 *
 * For sidebar quick-add (no modal, no summarize):
 * <KnowledgeProvider onNavigate={() => {}} onClose={() => {}}>
 *   <div className="p-2">
 *     <KnowledgeInput compact />
 *     <AddButton size="sm" />
 *   </div>
 * </KnowledgeProvider>
 *
 * For bulk upload (multiple files):
 * <KnowledgeProvider mode="bulk" onBatchComplete={...}>
 *   <KnowledgeMultiUpload />
 *   <KnowledgeBatchList />
 *   <ProcessAllButton />
 * </KnowledgeProvider>
 */
