'use client';

import { use, useState, useMemo } from 'react';
import useSWRInfinite from 'swr/infinite';
import { useDebounceCallback, useWindowSize } from 'usehooks-ts';
import { fetcher } from '@/lib/utils';
import { DocumentTable } from '@/components/document-table';
import { DocumentsEmptyState } from '@/components/documents-empty-state';
import { DocumentSearchBar } from '@/components/document-search-bar';
import { DocumentFilterBar } from '@/components/document-filter-bar';
import { Button } from '@/components/ui/button';
import { LoaderIcon } from '@/components/icons';
// Document type removed - using envelope/version schema
import { SidebarToggle } from '@/components/sidebar-toggle';
import { useSidebar } from '@/components/ui/sidebar';

interface PaginatedResponse {
  documents: Array<{
    id: string;
    title: string;
    contentLength: number;
    metadata: { documentType?: string } | Record<string, unknown> | null;
    createdAt: Date;
    isSearchable: boolean;
  }>;
  totalCount: number;
  hasMore: boolean;
  nextCursor: string | null;
}

export default function DocumentListPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = use(params);
  const { open } = useSidebar();
  const { width } = useWindowSize();

  // Immediate state for input (no flicker)
  const [searchInput, setSearchInput] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'created' | 'title'>('created');

  // Debounced state for API calls (400ms delay)
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSetSearch = useDebounceCallback((value: string) => {
    setSearchQuery(value);
  }, 400);

  // Build API URL with filters
  const getKey = (
    pageIndex: number,
    previousPageData: PaginatedResponse | null,
  ) => {
    // If no more data, return null
    if (previousPageData && !previousPageData.hasMore) return null;

    // Build query params
    const params = new URLSearchParams();
    params.set('limit', '50');
    if (previousPageData?.nextCursor)
      params.set('cursor', previousPageData.nextCursor);
    if (searchQuery) params.set('search', searchQuery);
    if (filterType && filterType !== 'all') params.set('type', filterType);
    params.set('sortBy', sortBy);
    params.set('sortOrder', 'desc');

    return `/api/workspace/${workspaceId}/document?${params.toString()}`;
  };

  const { data, error, size, setSize, isLoading, isValidating, mutate } =
    useSWRInfinite<PaginatedResponse>(getKey, fetcher);

  // Flatten all pages into single array
  const documents = useMemo(() => {
    return data ? data.flatMap((page) => page.documents) : [];
  }, [data]);

  const totalCount = data?.[0]?.totalCount || 0;
  const hasMore = data?.[data.length - 1]?.hasMore || false;
  const isLoadingMore =
    isLoading || (size > 0 && data && typeof data[size - 1] === 'undefined');
  const isInitialLoad = isLoading && !data; // Only true on very first load

  // Get unique document types for filter
  const documentTypes = useMemo(() => {
    const types = new Set<string>();
    documents.forEach((doc) => {
      const type =
        (doc.metadata &&
        typeof doc.metadata === 'object' &&
        'documentType' in doc.metadata
          ? (doc.metadata as { documentType?: string }).documentType
          : undefined) || 'text';
      types.add(type);
    });
    return Array.from(types).sort();
  }, [documents]);

  return (
    <div className="container mx-auto py-6">
      {/* Header - always visible */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {(!open || width < 768) && <SidebarToggle />}
            <h1 className="text-3xl font-semibold tracking-tight border-b pb-2">
              Knowledge Management
            </h1>
          </div>
          {isValidating && !isInitialLoad && (
            <div className="animate-spin text-muted-foreground">
              <LoaderIcon size={20} />
            </div>
          )}
        </div>
        {!isInitialLoad && (
          <div className="text-sm text-muted-foreground mt-2">
            {totalCount} {totalCount === 1 ? 'document' : 'documents'}
          </div>
        )}
      </div>

      {/* Search/Filter - always visible */}
      <div className="space-y-4 mb-6">
        <DocumentSearchBar
          value={searchInput}
          onChange={(value) => {
            setSearchInput(value);
            debouncedSetSearch(value);
            setSize(1); // Reset to page 1 on search
          }}
        />
        <DocumentFilterBar
          sortBy={sortBy}
          setSortBy={(value) => {
            setSortBy(value);
            setSize(1); // Reset to page 1 on sort change
          }}
          filterType={filterType}
          setFilterType={(value) => {
            setFilterType(value);
            setSize(1); // Reset to page 1 on filter change
          }}
          types={documentTypes}
        />
      </div>

      {/* Content area - conditional based on state */}
      {error ? (
        <div className="text-center text-destructive py-12">
          Failed to load documents. Please try again.
        </div>
      ) : isInitialLoad ? (
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin">
            <LoaderIcon size={32} />
          </div>
        </div>
      ) : !documents || documents.length === 0 ? (
        <DocumentsEmptyState workspaceId={workspaceId} />
      ) : (
        <>
          <DocumentTable
            documents={documents}
            workspaceId={workspaceId}
            onDocumentDeleted={mutate}
          />

          {hasMore && (
            <div className="flex justify-center mt-6">
              <Button
                onClick={() => setSize(size + 1)}
                disabled={isLoadingMore || isValidating}
                variant="outline"
                size="lg"
              >
                {isLoadingMore || isValidating ? (
                  <>
                    <div className="animate-spin mr-2">
                      <LoaderIcon size={16} />
                    </div>
                    Loading...
                  </>
                ) : (
                  'Load More'
                )}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
