'use client';

import { use, useMemo, useCallback } from 'react';
import useSWRInfinite from 'swr/infinite';
import { fetcher } from '@/lib/utils';
import { ChatTable } from '@/components/chat-table';
import { Button } from '@/components/ui/button';
import { LoaderIcon, PlusIcon } from '@/components/icons';
import { useRouter } from 'next/navigation';

interface ChatHistory {
  chats: Array<{
    id: string;
    title: string;
    createdAt: Date;
    messageCount: number;
  }>;
  hasMore: boolean;
}

export default function ChatListPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = use(params);
  const router = useRouter();

  const getKey = (pageIndex: number, previousPageData: ChatHistory | null) => {
    // If no more data, return null
    if (previousPageData && !previousPageData.hasMore) return null;

    // Build query params
    const queryParams = new URLSearchParams();
    queryParams.set('limit', '50');

    if (previousPageData?.chats?.length) {
      const lastChat =
        previousPageData.chats[previousPageData.chats.length - 1];
      queryParams.set('ending_before', lastChat.id);
    }

    return `/api/workspace/${workspaceId}/history?${queryParams.toString()}`;
  };

  const { data, error, size, setSize, isLoading, isValidating, mutate } =
    useSWRInfinite<ChatHistory>(getKey, fetcher, {
      revalidateFirstPage: false,
      revalidateOnFocus: true,
    });

  // Flatten all pages into single array
  const chats = useMemo(() => {
    return data ? data.flatMap((page) => page.chats) : [];
  }, [data]);

  const hasMore = data?.[data.length - 1]?.hasMore || false;
  const isLoadingMore =
    isLoading || (size > 0 && data && typeof data[size - 1] === 'undefined');
  const isInitialLoad = isLoading && !data;

  const handleChatDeleted = useCallback(
    (chatId: string) => {
      // Optimistically update the cache
      mutate(
        (currentData) => {
          if (!currentData) return currentData;
          return currentData.map((page) => ({
            ...page,
            chats: page.chats.filter((chat) => chat.id !== chatId),
          }));
        },
        { revalidate: false },
      );
    },
    [mutate],
  );

  return (
    <div className="container mx-auto py-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-semibold tracking-tight border-b pb-2 flex-1">
            Chat History
          </h1>
          <div className="flex items-center gap-2">
            {isValidating && !isInitialLoad && (
              <div className="animate-spin text-muted-foreground">
                <LoaderIcon size={20} />
              </div>
            )}
            <Button
              onClick={() => {
                router.push(`/workspace/${workspaceId}/chat/new`);
              }}
            >
              <PlusIcon size={16} />
              New Chat
            </Button>
          </div>
        </div>
        {!isInitialLoad && (
          <div className="text-sm text-muted-foreground mt-2">
            {chats.length} {chats.length === 1 ? 'chat' : 'chats'}
          </div>
        )}
      </div>

      {/* Content area */}
      {error ? (
        <div className="text-center text-destructive py-12">
          Failed to load chats. Please try again.
        </div>
      ) : isInitialLoad ? (
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin">
            <LoaderIcon size={32} />
          </div>
        </div>
      ) : !chats || chats.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
          <p className="text-lg text-muted-foreground mb-4">
            No chats yet. Start a conversation!
          </p>
          <Button
            onClick={() => {
              router.push(`/workspace/${workspaceId}/chat/new`);
            }}
          >
            <PlusIcon size={16} />
            New Chat
          </Button>
        </div>
      ) : (
        <>
          <ChatTable
            chats={chats}
            workspaceId={workspaceId}
            onChatDeleted={handleChatDeleted}
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
