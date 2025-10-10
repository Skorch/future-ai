'use client';

import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import type { Objective } from '@/lib/db/objective';

interface ObjectiveCardProps {
  objective: Objective;
  workspaceId: string;
}

export function ObjectiveCard({ objective, workspaceId }: ObjectiveCardProps) {
  return (
    <Link href={`/workspace/${workspaceId}/objective/${objective.id}`}>
      <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-lg line-clamp-2">
              {objective.title}
            </CardTitle>
            <Badge
              variant={
                objective.status === 'published' ? 'default' : 'secondary'
              }
            >
              {objective.status}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {objective.description && (
            <p className="text-sm text-muted-foreground line-clamp-3 mb-4">
              {objective.description}
            </p>
          )}
          <div className="text-xs text-muted-foreground">
            Created{' '}
            {formatDistanceToNow(new Date(objective.createdAt), {
              addSuffix: true,
            })}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
