export default function Loading() {
  return (
    <div className="container mx-auto py-6">
      <div className="animate-pulse space-y-4">
        <div className="h-10 bg-muted rounded w-1/4" />
        <div className="h-96 bg-muted rounded" />
      </div>
    </div>
  );
}
