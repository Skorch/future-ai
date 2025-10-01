'use client';

import { formatDistanceToNow } from 'date-fns';
import { DocumentTypeBadge } from './document-type-badge';
import { DocumentByteSize } from './document-byte-size';
import { Button } from './ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './ui/tooltip';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

interface DocumentHeaderProps {
  document: {
    id: string;
    title: string;
    metadata: { documentType?: string };
    createdAt: Date;
    contentLength: number;
  };
}

export function DocumentHeader({ document }: DocumentHeaderProps) {
  return (
    <Card className="mb-6">
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-2">
            <CardTitle className="text-2xl">{document.title}</CardTitle>
            <DocumentTypeBadge
              type={document.metadata?.documentType || 'text'}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <span className="font-medium">Created: </span>
            <span className="text-muted-foreground">
              {formatDistanceToNow(new Date(document.createdAt), {
                addSuffix: true,
              })}
            </span>
          </div>
          <div>
            <span className="font-medium">Byte Size: </span>
            <DocumentByteSize
              bytes={document.contentLength}
              className="text-muted-foreground"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2 pt-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  disabled
                  variant="outline"
                  className="cursor-not-allowed"
                >
                  In Knowledge Base
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Available in next release</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  disabled
                  variant="outline"
                  className="cursor-not-allowed"
                >
                  Edit Doc
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Available in next release</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  disabled
                  variant="destructive"
                  className="cursor-not-allowed"
                >
                  Delete
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Available in next release</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </CardContent>
    </Card>
  );
}
