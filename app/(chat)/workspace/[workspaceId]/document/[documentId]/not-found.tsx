import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function DocumentNotFound() {
  return (
    <div className="container mx-auto py-6">
      <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center">
        <h2 className="text-xl font-semibold mb-2">Document not found</h2>
        <p className="text-muted-foreground mb-6 max-w-md">
          The document you&apos;re looking for doesn&apos;t exist or has been
          deleted.
        </p>
        <Button asChild>
          <Link href="..">Back to Documents</Link>
        </Button>
      </div>
    </div>
  );
}
