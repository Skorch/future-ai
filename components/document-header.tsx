'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { DocumentTypeBadge } from './document-type-badge';
import { DocumentByteSize } from './document-byte-size';
import { Button } from './ui/button';
import { Switch } from './ui/switch';
import { Label } from './ui/label';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from './ui/alert-dialog';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

interface DocumentHeaderProps {
  document: {
    id: string;
    title: string;
    metadata: { documentType?: string };
    createdAt: Date;
    contentLength: number;
    isSearchable?: boolean; // Optional - only for KnowledgeDocuments
  };
  workspaceId: string;
}

export function DocumentHeader({ document, workspaceId }: DocumentHeaderProps) {
  const router = useRouter();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isSearchable, setIsSearchable] = useState(
    document.isSearchable ?? false,
  );

  // Toggle searchable handler
  const handleToggleSearchable = () => {
    const newState = !isSearchable;

    // Optimistic update - update UI immediately
    setIsSearchable(newState);

    const promise = fetch(
      `/api/workspace/${workspaceId}/document/${document.id}/searchable`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isSearchable: newState }),
      },
    );

    toast.promise(promise, {
      loading: 'Updating knowledge base...',
      success: () => {
        // Refresh the page data
        router.refresh();
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
  };

  // Delete handler
  const handleDelete = () => {
    const promise = fetch(
      `/api/workspace/${workspaceId}/document/${document.id}/delete`,
      { method: 'POST' },
    );

    toast.promise(promise, {
      loading: 'Deleting document...',
      success: () => {
        // Navigate away after successful delete
        router.push(`/workspace/${workspaceId}/document`);
        return 'Document deleted successfully';
      },
      error: 'Failed to delete document',
    });

    setShowDeleteDialog(false);
  };

  // Edit handler
  const handleEdit = () => {
    router.push(`/workspace/${workspaceId}/document/${document.id}/edit`);
  };

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
          {/* Toggle Searchable - Only for Knowledge Documents (not ObjectiveDocuments) */}
          {document.isSearchable !== undefined && (
            <div className="flex items-center gap-2">
              <Switch
                id="searchable"
                checked={isSearchable}
                onCheckedChange={handleToggleSearchable}
              />
              <Label htmlFor="searchable" className="cursor-pointer">
                In Knowledge Base
              </Label>
            </div>
          )}

          {/* Edit Button */}
          <Button onClick={handleEdit} variant="outline">
            Edit Document
          </Button>

          {/* Delete Button with Confirmation */}
          <AlertDialog
            open={showDeleteDialog}
            onOpenChange={setShowDeleteDialog}
          >
            <AlertDialogTrigger asChild>
              <Button variant="destructive">Delete</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Document</AlertDialogTitle>
                <div className="space-y-2">
                  <AlertDialogDescription>
                    Are you sure you want to delete &ldquo;{document.title}
                    &rdquo;?
                  </AlertDialogDescription>
                  <AlertDialogDescription>This will:</AlertDialogDescription>
                  <ul className="list-disc list-inside text-sm text-muted-foreground ml-4">
                    <li>Remove the document from your library</li>
                    <li>Remove it from the knowledge base</li>
                    <li>This cannot be undone</li>
                  </ul>
                </div>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete}>
                  Delete Document
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  );
}
