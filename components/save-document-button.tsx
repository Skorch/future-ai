'use client';

import { SaveIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import type { Session } from 'next-auth';
import { useSession } from 'next-auth/react';
import { useState } from 'react';

interface SaveDocumentButtonProps {
  documentId: string | null;
  session?: Session | null;
}

export function SaveDocumentButton({
  documentId,
  session: providedSession,
}: SaveDocumentButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { data: sessionData } = useSession();

  // Use provided session or fallback to useSession
  const session = providedSession || sessionData;

  // Only render if user is authenticated
  if (!session?.user) {
    return null;
  }

  const handleSave = async () => {
    if (!documentId) {
      toast.error('Document must be saved first');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`/api/document/${documentId}/save`, {
        method: 'POST',
      });

      if (response.ok) {
        toast.success('Document saved to storage!');
      } else {
        toast.error('Failed to save document');
      }
    } catch (error) {
      toast.error('Failed to save document');
    } finally {
      setIsLoading(false);
    }
  };

  // Default icon button for toolbar - matching artifact actions style
  return (
    <Button
      variant="outline"
      className="h-fit p-2 dark:hover:bg-zinc-700"
      onClick={handleSave}
      title="Save to storage"
      disabled={isLoading || !documentId}
    >
      <SaveIcon size={18} />
    </Button>
  );
}
