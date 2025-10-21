'use client';

import { formatDistanceToNow } from 'date-fns';
import { DocumentTypeBadge } from './document-type-badge';
import { DocumentByteSize } from './document-byte-size';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import {
  SearchableToggle,
  EditButton,
  DeleteButton,
} from './document-header/primitives';

interface DocumentHeaderProps {
  document: {
    id: string;
    title: string;
    metadata: { documentType?: string };
    createdAt: Date;
    contentLength: number;
    isSearchable?: boolean; // Optional - only for KnowledgeDocuments
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

        <div className="flex flex-wrap gap-3 pt-2">
          {/* Toggle Searchable - Only for Knowledge Documents */}
          {document.isSearchable !== undefined && <SearchableToggle />}

          {/* Edit Button */}
          <EditButton />

          {/* Delete Button with Confirmation */}
          <DeleteButton documentTitle={document.title} />
        </div>
      </CardContent>
    </Card>
  );
}
