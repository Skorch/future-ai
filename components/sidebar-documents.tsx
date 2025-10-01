'use client';

import { isToday, isYesterday, subMonths, subWeeks } from 'date-fns';
import { useParams, useRouter } from 'next/navigation';
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  useSidebar,
} from '@/components/ui/sidebar';
import { fetcher } from '@/lib/utils';
import { DocumentItem } from './sidebar-document-item';
import useSWRInfinite from 'swr/infinite';

type GroupedDocuments = {
  today: DocumentHistory['documents'];
  yesterday: DocumentHistory['documents'];
  lastWeek: DocumentHistory['documents'];
  lastMonth: DocumentHistory['documents'];
  older: DocumentHistory['documents'];
};

export interface DocumentHistory {
  documents: Array<{
    id: string;
    title: string;
    documentType: string;
    createdAt: Date;
    isSearchable: boolean;
    metadata: Record<string, unknown> | null;
  }>;
  totalCount: number;
  hasMore: boolean;
  nextCursor: string | null;
}

const PAGE_SIZE = 20;

const groupDocumentsByDate = (
  documents: DocumentHistory['documents'],
): GroupedDocuments => {
  const now = new Date();
  const oneWeekAgo = subWeeks(now, 1);
  const oneMonthAgo = subMonths(now, 1);

  return documents.reduce(
    (groups, doc) => {
      const docDate = new Date(doc.createdAt);

      if (isToday(docDate)) {
        groups.today.push(doc);
      } else if (isYesterday(docDate)) {
        groups.yesterday.push(doc);
      } else if (docDate > oneWeekAgo) {
        groups.lastWeek.push(doc);
      } else if (docDate > oneMonthAgo) {
        groups.lastMonth.push(doc);
      } else {
        groups.older.push(doc);
      }

      return groups;
    },
    {
      today: [],
      yesterday: [],
      lastWeek: [],
      lastMonth: [],
      older: [],
    } as GroupedDocuments,
  );
};

export function getDocumentHistoryPaginationKey(
  pageIndex: number,
  previousPageData: DocumentHistory,
  workspaceId: string | null,
) {
  if (!workspaceId) return null;

  if (previousPageData && previousPageData.hasMore === false) {
    return null;
  }

  // Use the same paginated endpoint as the document list page
  // but with limit=20 for sidebar display
  if (pageIndex === 0) {
    return `/api/workspace/${workspaceId}/document?limit=20&sortBy=created&sortOrder=desc`;
  }

  // Support pagination if needed (though unlikely for sidebar)
  if (previousPageData?.nextCursor) {
    return `/api/workspace/${workspaceId}/document?limit=20&sortBy=created&sortOrder=desc&cursor=${previousPageData.nextCursor}`;
  }

  return null;
}

export function SidebarDocuments({ workspaceId }: { workspaceId: string }) {
  const { setOpenMobile } = useSidebar();
  const { id } = useParams();
  const router = useRouter();

  const { data: paginatedDocumentHistories, isLoading } =
    useSWRInfinite<DocumentHistory>(
      (pageIndex, previousPageData) =>
        getDocumentHistoryPaginationKey(
          pageIndex,
          previousPageData,
          workspaceId,
        ),
      fetcher,
    );

  const hasReachedEnd = paginatedDocumentHistories
    ? paginatedDocumentHistories.some((page) => page.hasMore === false)
    : false;

  const hasEmptyDocumentHistory = paginatedDocumentHistories
    ? paginatedDocumentHistories.every((page) => page?.documents?.length === 0)
    : false;

  if (isLoading) {
    return (
      <SidebarGroup>
        <div className="px-2 py-1 text-xs text-sidebar-foreground/50">
          Documents
        </div>
        <SidebarGroupContent>
          <div className="flex flex-col">
            {[44, 32, 28, 64, 52].map((item) => (
              <div
                key={item}
                className="flex gap-2 items-center px-2 h-8 rounded-md"
              >
                <div
                  className="h-4 rounded-md flex-1 max-w-[--skeleton-width] bg-sidebar-accent-foreground/10"
                  style={
                    {
                      '--skeleton-width': `${item}%`,
                    } as React.CSSProperties
                  }
                />
              </div>
            ))}
          </div>
        </SidebarGroupContent>
      </SidebarGroup>
    );
  }

  if (hasEmptyDocumentHistory) {
    return (
      <SidebarGroup>
        <div className="px-2 py-1 text-xs text-sidebar-foreground/50">
          Documents
        </div>
        <SidebarGroupContent>
          <div className="flex flex-row gap-2 justify-center items-center px-2 w-full text-sm text-zinc-500">
            Your documents will appear here once you start creating them!
          </div>
        </SidebarGroupContent>
      </SidebarGroup>
    );
  }

  return (
    <>
      <SidebarGroup>
        <div className="px-2 py-1 text-xs text-sidebar-foreground/50">
          Documents
        </div>
        <SidebarGroupContent>
          <SidebarMenu>
            {paginatedDocumentHistories &&
              (() => {
                const documentsFromHistory = paginatedDocumentHistories.flatMap(
                  (paginatedDocumentHistory) =>
                    paginatedDocumentHistory?.documents || [],
                );

                const groupedDocuments =
                  groupDocumentsByDate(documentsFromHistory);

                return (
                  <div className="flex flex-col gap-6">
                    {groupedDocuments.today.length > 0 && (
                      <div>
                        <div className="px-2 py-1 text-xs text-sidebar-foreground/50">
                          Today
                        </div>
                        {groupedDocuments.today.map((doc) => (
                          <DocumentItem
                            key={`doc-${doc.id}`}
                            document={doc}
                            workspaceId={workspaceId}
                            isActive={doc.id === id}
                            setOpenMobile={setOpenMobile}
                          />
                        ))}
                      </div>
                    )}

                    {groupedDocuments.yesterday.length > 0 && (
                      <div>
                        <div className="px-2 py-1 text-xs text-sidebar-foreground/50">
                          Yesterday
                        </div>
                        {groupedDocuments.yesterday.map((doc) => (
                          <DocumentItem
                            key={`doc-${doc.id}`}
                            document={doc}
                            workspaceId={workspaceId}
                            isActive={doc.id === id}
                            setOpenMobile={setOpenMobile}
                          />
                        ))}
                      </div>
                    )}

                    {groupedDocuments.lastWeek.length > 0 && (
                      <div>
                        <div className="px-2 py-1 text-xs text-sidebar-foreground/50">
                          Last 7 days
                        </div>
                        {groupedDocuments.lastWeek.map((doc) => (
                          <DocumentItem
                            key={`doc-${doc.id}`}
                            document={doc}
                            workspaceId={workspaceId}
                            isActive={doc.id === id}
                            setOpenMobile={setOpenMobile}
                          />
                        ))}
                      </div>
                    )}

                    {groupedDocuments.lastMonth.length > 0 && (
                      <div>
                        <div className="px-2 py-1 text-xs text-sidebar-foreground/50">
                          Last 30 days
                        </div>
                        {groupedDocuments.lastMonth.map((doc) => (
                          <DocumentItem
                            key={`doc-${doc.id}`}
                            document={doc}
                            workspaceId={workspaceId}
                            isActive={doc.id === id}
                            setOpenMobile={setOpenMobile}
                          />
                        ))}
                      </div>
                    )}

                    {groupedDocuments.older.length > 0 && (
                      <div>
                        <div className="px-2 py-1 text-xs text-sidebar-foreground/50">
                          Older than last month
                        </div>
                        {groupedDocuments.older.map((doc) => (
                          <DocumentItem
                            key={`doc-${doc.id}`}
                            document={doc}
                            workspaceId={workspaceId}
                            isActive={doc.id === id}
                            setOpenMobile={setOpenMobile}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}
          </SidebarMenu>

          {/* View All Documents link at bottom of document list */}
          <div className="p-2">
            <button
              type="button"
              className="w-full text-left text-sm text-muted-foreground hover:text-foreground transition-colors py-1"
              onClick={() => {
                setOpenMobile(false);
                router.push(`/workspace/${workspaceId}/document`);
              }}
            >
              View All Documents →
            </button>
          </div>
        </SidebarGroupContent>
      </SidebarGroup>
    </>
  );
}
