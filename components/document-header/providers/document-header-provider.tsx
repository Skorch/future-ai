'use client';

import {
  createContext,
  useContext,
  useState,
  type ReactNode,
  useCallback,
} from 'react';
import { toast } from 'sonner';

/**
 * DocumentHeaderProvider - Handles all business logic for document operations
 *
 * This provider follows the Single Responsibility Principle by handling:
 * - API calls for toggle searchable
 * - API calls for delete
 * - State management for loading states
 * - Optimistic updates with rollback
 *
 * Routing and navigation are delegated to parent via callbacks:
 * - onNavigate: Parent controls navigation (edit, etc.)
 * - onRefresh: Parent controls page refresh
 * - onDeleteSuccess: Parent controls post-delete navigation
 */

interface DocumentHeaderProviderProps {
  children: ReactNode;
  document: {
    id: string;
    title: string;
    isSearchable?: boolean; // Optional - only for KnowledgeDocuments
  };
  workspaceId: string;
  documentType: 'knowledge' | 'objective';
  onNavigate: (url: string) => void; // Parent handles navigation
  onRefresh: () => void; // Parent handles refresh
  onDeleteSuccess: () => void; // Parent handles post-delete navigation
}

interface DocumentHeaderContext {
  isSearchable: boolean;
  isDeleting: boolean;
  isTogglingSearchable: boolean;
  toggleSearchable: () => void;
  deleteDocument: () => void;
  editDocument: () => void; // Calls onNavigate with edit route
}

const DocumentHeaderContext = createContext<DocumentHeaderContext | null>(null);

export function DocumentHeaderProvider({
  children,
  document,
  workspaceId,
  documentType,
  onNavigate,
  onRefresh,
  onDeleteSuccess,
}: DocumentHeaderProviderProps) {
  const [isSearchable, setIsSearchable] = useState(
    document.isSearchable ?? false,
  );
  const [isDeleting, setIsDeleting] = useState(false);
  const [isTogglingSearchable, setIsTogglingSearchable] = useState(false);

  /**
   * Toggle Searchable Logic (from document-header.tsx lines 50-82)
   * - Optimistic update: setIsSearchable immediately
   * - Determine endpoint based on documentType
   * - Make PATCH request
   * - Use toast.promise with loading/success/error
   * - On success: call onRefresh() callback
   * - On error: rollback to previous state
   */
  const toggleSearchable = useCallback(() => {
    const newState = !isSearchable;

    // Optimistic update - update UI immediately
    setIsSearchable(newState);
    setIsTogglingSearchable(true);

    const endpoint =
      documentType === 'knowledge'
        ? `/api/workspace/${workspaceId}/knowledge/${document.id}`
        : `/api/workspace/${workspaceId}/document/${document.id}/searchable`;

    const promise = fetch(endpoint, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isSearchable: newState }),
    }).finally(() => {
      setIsTogglingSearchable(false);
    });

    toast.promise(promise, {
      loading: 'Updating knowledge base...',
      success: () => {
        // Refresh the page data via parent callback
        onRefresh();
        return newState
          ? 'Added to knowledge base'
          : 'Removed from knowledge base';
      },
      error: () => {
        // Rollback on error
        setIsSearchable(!newState);
        return 'Failed to update document';
      },
    });
  }, [isSearchable, documentType, workspaceId, document.id, onRefresh]);

  /**
   * Delete Logic (from document-header.tsx lines 85-110)
   * - Determine endpoint and method based on documentType
   * - Make request (DELETE or POST)
   * - Use toast.promise
   * - On success: call onDeleteSuccess() callback
   * - Parent decides where to navigate
   */
  const deleteDocument = useCallback(() => {
    setIsDeleting(true);

    const endpoint =
      documentType === 'knowledge'
        ? `/api/workspace/${workspaceId}/knowledge/${document.id}`
        : `/api/workspace/${workspaceId}/document/${document.id}/delete`;

    const method = documentType === 'knowledge' ? 'DELETE' : 'POST';

    const promise = fetch(endpoint, { method }).finally(() => {
      setIsDeleting(false);
    });

    toast.promise(promise, {
      loading: 'Deleting document...',
      success: () => {
        // Navigate away after successful delete via parent callback
        onDeleteSuccess();
        return 'Document deleted successfully';
      },
      error: 'Failed to delete document',
    });
  }, [documentType, workspaceId, document.id, onDeleteSuccess]);

  /**
   * Edit Logic (from document-header.tsx lines 113-119)
   * - Determine edit route based on documentType
   * - Call onNavigate(editRoute)
   * - Parent handles actual navigation
   */
  const editDocument = useCallback(() => {
    const editRoute =
      documentType === 'knowledge'
        ? `/workspace/${workspaceId}/knowledge/${document.id}/edit`
        : `/workspace/${workspaceId}/document/${document.id}/edit`;
    onNavigate(editRoute);
  }, [documentType, workspaceId, document.id, onNavigate]);

  const value: DocumentHeaderContext = {
    isSearchable,
    isDeleting,
    isTogglingSearchable,
    toggleSearchable,
    deleteDocument,
    editDocument,
  };

  return (
    <DocumentHeaderContext.Provider value={value}>
      {children}
    </DocumentHeaderContext.Provider>
  );
}

/**
 * Hook to access DocumentHeader context
 * @throws Error if used outside of DocumentHeaderProvider
 */
export function useDocumentHeader() {
  const context = useContext(DocumentHeaderContext);
  if (!context) {
    throw new Error(
      'useDocumentHeader must be used within DocumentHeaderProvider',
    );
  }
  return context;
}
