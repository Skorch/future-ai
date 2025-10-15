'use client';

import { useState } from 'react';
import { useSWRConfig } from 'swr';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { AIAssistedTextInput } from '@/components/ui/ai-assisted-text-input';
import { generateAIText } from '@/app/(chat)/actions';

interface CreateObjectiveDialogProps {
  workspaceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (objectiveId: string) => void;
}

export function CreateObjectiveDialog({
  workspaceId,
  open,
  onOpenChange,
  onCreated,
}: CreateObjectiveDialogProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const { mutate } = useSWRConfig();

  const handleCreate = async () => {
    if (!title.trim()) return;

    setIsCreating(true);
    try {
      const response = await fetch(`/api/workspace/${workspaceId}/objectives`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description }),
      });

      if (!response.ok) {
        throw new Error('Failed to create objective');
      }

      const objective = await response.json();

      // Invalidate SWR cache for sidebar to refetch
      mutate(`/api/workspace/${workspaceId}/objectives`);

      setTitle('');
      setDescription('');
      onOpenChange(false);
      toast.success('Objective created successfully');
      onCreated(objective.id);
    } catch (error) {
      toast.error('Failed to create objective. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="sm:max-w-[425px]">
        <AlertDialogHeader>
          <AlertDialogTitle>Create New Objective</AlertDialogTitle>
          <AlertDialogDescription>
            Objectives organize your work and track progress toward specific
            goals.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              placeholder="Enter objective title..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
              disabled={isCreating}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="description">Description (optional)</Label>
            <AIAssistedTextInput
              value={description}
              onChange={setDescription}
              multiline
              rows={3}
              placeholder="Describe this objective..."
              disabled={isCreating}
              instruction="Generate a description for this objective"
              context={{ title }}
              generateAction={generateAIText}
            />
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isCreating}>Cancel</AlertDialogCancel>
          <Button onClick={handleCreate} disabled={!title.trim() || isCreating}>
            {isCreating ? 'Creating...' : 'Create Objective'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
