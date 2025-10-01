'use client';

import { Button } from '@/components/ui/button';

export default function DocumentListError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="container mx-auto py-6">
      <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center">
        <h2 className="text-xl font-semibold mb-2">Failed to load documents</h2>
        <p className="text-muted-foreground mb-6 max-w-md">{error.message}</p>
        <Button onClick={() => reset()}>Try Again</Button>
      </div>
    </div>
  );
}
