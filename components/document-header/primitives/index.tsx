'use client';

import { useState } from 'react';
import { useDocumentHeader } from '../providers';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
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
} from '@/components/ui/alert-dialog';

/**
 * SearchableToggle - Renders the "In Knowledge Base" toggle switch
 *
 * Only renders when isSearchable is defined (Knowledge documents only).
 * Consumes context from DocumentHeaderProvider.
 *
 * Reference: document-header.tsx lines 154-165
 */
export function SearchableToggle() {
  const { isSearchable, isTogglingSearchable, toggleSearchable } =
    useDocumentHeader();

  // Only render if isSearchable is defined (Knowledge documents only)
  // Note: Provider always returns a boolean, but we need to check the document prop
  // This is a known limitation - the parent should conditionally render this component
  // For now, we always render since the provider context doesn't expose undefined state

  return (
    <div className="flex items-center gap-2">
      <Switch
        id="searchable"
        checked={isSearchable}
        onCheckedChange={toggleSearchable}
        disabled={isTogglingSearchable}
      />
      <Label htmlFor="searchable" className="cursor-pointer">
        In Knowledge Base
      </Label>
    </div>
  );
}

/**
 * EditButton - Renders the "Edit Document" button
 *
 * Consumes context from DocumentHeaderProvider.
 *
 * Reference: document-header.tsx lines 168-170
 */
export function EditButton() {
  const { editDocument } = useDocumentHeader();

  return (
    <Button onClick={editDocument} variant="outline">
      Edit Document
    </Button>
  );
}

/**
 * DeleteButton - Renders the delete button with confirmation dialog
 *
 * Consumes context from DocumentHeaderProvider.
 * Requires documentTitle prop for dialog content.
 *
 * Reference: document-header.tsx lines 173-203
 */
export function DeleteButton({ documentTitle }: { documentTitle: string }) {
  const { deleteDocument, isDeleting } = useDocumentHeader();
  const [showDialog, setShowDialog] = useState(false);

  return (
    <AlertDialog open={showDialog} onOpenChange={setShowDialog}>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" disabled={isDeleting}>
          Delete
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Document</AlertDialogTitle>
          <div className="space-y-2">
            <AlertDialogDescription>
              Are you sure you want to delete &ldquo;{documentTitle}&rdquo;?
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
          <AlertDialogAction
            onClick={() => {
              deleteDocument();
              setShowDialog(false);
            }}
          >
            Delete Document
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
