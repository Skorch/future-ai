export default function NotFound() {
  return (
    <div className="container mx-auto py-6">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold">Knowledge Document Not Found</h1>
        <p className="text-muted-foreground">
          The knowledge document you&apos;re looking for doesn&apos;t exist or
          you don&apos;t have access to it.
        </p>
      </div>
    </div>
  );
}
