'use client';

import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import { FileTextIcon } from 'lucide-react';
import type { KnowledgeDocument } from '@/lib/db/knowledge-document';

interface KnowledgeCardProps {
  document: KnowledgeDocument;
  workspaceId: string;
}

export function KnowledgeCard({ document, workspaceId }: KnowledgeCardProps) {
  const contentPreview = document.content.slice(0, 200);

  return (
    <Link href={`/api/knowledge/${document.id}`}>
      <Card className="hover:bg-accent transition-colors cursor-pointer">
        <CardContent className="p-4">
          <div className="flex gap-4">
            <div className="shrink-0">
              <div className="size-10 rounded bg-primary/10 flex items-center justify-center">
                <FileTextIcon className="size-5 text-primary" />
              </div>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2 mb-1">
                <h3 className="font-semibold text-sm line-clamp-1">
                  {document.title}
                </h3>
                <Badge variant="outline" className="shrink-0">
                  {document.documentType}
                </Badge>
              </div>

              <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                {contentPreview}
                {document.content.length > 200 && '...'}
              </p>

              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span>
                  {formatDistanceToNow(new Date(document.createdAt), {
                    addSuffix: true,
                  })}
                </span>
                {!document.isSearchable && (
                  <Badge variant="secondary" className="text-xs">
                    Not searchable
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
