import { Skeleton } from '@/components/ui/skeleton';

export default function DocumentListLoading() {
  const skeletonKeys = Array.from({ length: 10 }, () => crypto.randomUUID());

  return (
    <div className="container mx-auto py-6">
      <Skeleton className="h-10 w-64 mb-6" />
      <div className="space-y-3">
        {skeletonKeys.map((key) => (
          <Skeleton key={key} className="h-16 w-full" />
        ))}
      </div>
    </div>
  );
}
