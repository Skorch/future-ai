import { Skeleton } from '@/components/ui/skeleton';

export default function DocumentDetailLoading() {
  return (
    <div className="container mx-auto py-6">
      <Skeleton className="h-10 w-40 mb-4" />
      <div className="border rounded-lg p-6 space-y-4 mb-6">
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-6 w-24" />
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-10 w-24" />
        </div>
      </div>
      <div className="border rounded-lg p-6 space-y-3">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    </div>
  );
}
