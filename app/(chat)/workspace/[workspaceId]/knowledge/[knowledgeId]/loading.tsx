export default function Loading() {
  return (
    <div className="container mx-auto py-6">
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-muted rounded w-1/3" />
        <div className="h-64 bg-muted rounded" />
      </div>
    </div>
  );
}
