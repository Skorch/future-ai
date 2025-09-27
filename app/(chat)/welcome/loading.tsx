export default function WelcomeLoading() {
  return (
    <div className="flex h-screen w-full flex-col items-center justify-center">
      <div className="space-y-4 text-center">
        <div className="inline-block animate-spin rounded-full size-12 border-b-2 border-primary" />
        <p className="text-lg text-muted-foreground">
          Preparing your demo workspace...
        </p>
        <p className="text-sm text-muted-foreground">
          Loading sample conversations and documents
        </p>
      </div>
    </div>
  );
}
