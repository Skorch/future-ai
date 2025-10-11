import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

export default function ObjectiveDetailLoading() {
  return (
    <div className="flex flex-col h-full">
      {/* Header Section */}
      <div className="border-b">
        <div className="px-6 pt-8 pb-6">
          {/* Back link */}
          <Skeleton className="h-4 w-40 mb-4" />

          {/* Title and toggle */}
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex-1">
              <Skeleton className="h-9 w-3/4 mb-2" />
              <Skeleton className="h-6 w-full max-w-xl" />
            </div>
            <Skeleton className="h-6 w-24" />
          </div>

          {/* Metadata */}
          <div className="flex items-center gap-4">
            <Skeleton className="h-6 w-20" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>

        {/* Quick Actions */}
        <div className="px-6 pb-6">
          <div className="flex gap-2">
            <Skeleton className="h-10 w-32 rounded-full" />
            <Skeleton className="h-10 w-40 rounded-full" />
            <Skeleton className="h-10 w-36 rounded-full" />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6 space-y-6">
        {/* Document Card Skeleton */}
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48 mb-2" />
            <Skeleton className="h-4 w-64" />
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          </CardContent>
        </Card>

        {/* Task History Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-7 w-32" />
            <Skeleton className="h-5 w-16" />
          </div>

          {/* Chat Card Skeletons */}
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-5 w-3/4" />
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-4 w-32" />
                    </div>
                  </div>
                  <Skeleton className="size-5" />
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
