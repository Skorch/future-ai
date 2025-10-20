'use client';

import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { PlusIcon, MessageSquare, ChevronRightIcon } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface Chat {
  id: string;
  title: string;
  createdAt: Date;
  messageCount: number;
}

interface TaskHistoryTabProps {
  workspaceId: string;
  objectiveId: string;
  chats: Chat[];
}

export function TaskHistoryTab({
  workspaceId,
  objectiveId,
  chats,
}: TaskHistoryTabProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold tracking-tight">Task History</h2>
        <span className="text-sm font-medium text-muted-foreground">
          {chats.length} {chats.length === 1 ? 'task' : 'tasks'}
        </span>
      </div>

      {chats.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="rounded-full bg-muted p-4 mb-4">
              <MessageSquare className="size-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No tasks yet</h3>
            <p className="text-sm text-muted-foreground mb-6 text-center max-w-sm">
              Start your first task to begin working on this objective
            </p>
            <Button asChild className="rounded-full">
              <Link
                href={`/workspace/${workspaceId}/chat/new?objectiveId=${objectiveId}`}
              >
                <PlusIcon className="size-4 mr-2" />
                New Task
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {chats.map((chat) => (
            <Link
              key={chat.id}
              href={`/workspace/${workspaceId}/chat/${chat.id}`}
              className="group"
            >
              <Card className="hover:shadow-lg transition-all duration-200 cursor-pointer group-hover:translate-y-[-2px]">
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-base font-semibold mb-1 truncate">
                        {chat.title}
                      </CardTitle>
                      <CardDescription className="flex items-center gap-2 flex-wrap text-sm">
                        <span className="flex items-center gap-1">
                          <MessageSquare className="size-3.5" />
                          {chat.messageCount || 0}{' '}
                          {chat.messageCount === 1 ? 'message' : 'messages'}
                        </span>
                        <span className="text-muted-foreground/40">•</span>
                        <span>
                          Updated{' '}
                          {formatDistanceToNow(new Date(chat.createdAt), {
                            addSuffix: true,
                          })}
                        </span>
                      </CardDescription>
                    </div>

                    {/* Hover indicator */}
                    <ChevronRightIcon className="size-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                  </div>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
